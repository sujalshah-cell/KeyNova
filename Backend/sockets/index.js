const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Room = require('../models/Room');
const Notification = require('../models/Notification');
const TypingResult = require('../models/TypingResult');

console.log(
  '>>> SOCKETS/INDEX.JS LOADED - VERSION CHECK <<<'
);

/*
|--------------------------------------------------------------------------
| PUBLIC ROOM
|--------------------------------------------------------------------------
*/

function publicRoom(room) {
  return {
    roomId: room.roomId,
    ownerUsername: room.ownerUsername,
    mode: room.mode,
    duration: room.duration,
    maxPlayers: room.maxPlayers,
    status: room.status,
    participants: room.participants,
    startedAt: room.startedAt,
    finishedAt: room.finishedAt,
  };
}

/*
|--------------------------------------------------------------------------
| NOTIFY PARTICIPANTS
|--------------------------------------------------------------------------
| Delivers an event to every CURRENT participant's personal channel
| (`user:<id>`), instead of the room-specific socket.io channel
| (`room:<roomId>`). Every socket already joins its personal channel the
| instant it connects (see io.on('connection') below) — well before it
| ever runs room:join for a specific room. That means this reaches a
| participant even if their socket hasn't opened this room's page yet,
| or briefly reconnected. This is what makes room state changes (start,
| countdown, go, kick, etc.) reach everyone WITHOUT requiring a reload.
|--------------------------------------------------------------------------
*/

function notifyParticipants(io, room, event, payload) {
  room.participants.forEach((participant) => {
    io.to(`user:${participant.userId}`).emit(event, payload);
  });
}

/*
|--------------------------------------------------------------------------
| SOCKET SETUP
|--------------------------------------------------------------------------
*/

module.exports = function attachSockets(io) {
  /*
  |--------------------------------------------------------------------------
  | SOCKET AUTHENTICATION
  |--------------------------------------------------------------------------
  */

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token;

      if (!token) {
        return next(
          new Error('unauthorized')
        );
      }

      const payload =
        jwt.verify(
          token,
          process.env.JWT_SECRET
        );

      const user =
        await User.findById(
          payload.id
        ).select('-passwordHash');

      if (!user) {
        return next(
          new Error('unauthorized')
        );
      }

      socket.user = user;

      console.log(
        '[socket auth] authenticated:',
        user.username
      );

      next();
    } catch (error) {
      console.log(
        '[socket auth] rejected:',
        error.message
      );

      next(
        new Error('unauthorized')
      );
    }
  });

  /*
  |--------------------------------------------------------------------------
  | CONNECTION
  |--------------------------------------------------------------------------
  */

  io.on('connection', (socket) => {
    console.log(
      '[socket] connected, user =',
      socket.user?.username,
      'socket.id =',
      socket.id
    );

    /*
    |--------------------------------------------------------------------------
    | PERSONAL NOTIFICATION ROOM
    |--------------------------------------------------------------------------
    | Joined immediately on connect — this is the channel
    | notifyParticipants() actually delivers to, and it's also used for
    | the notification bell elsewhere in the app.
    |--------------------------------------------------------------------------
    */

    socket.join(
      `user:${socket.user._id}`
    );

    /*
    |--------------------------------------------------------------------------
    | ROOM JOIN
    |--------------------------------------------------------------------------
    | Still exists so the client can confirm it's looking at a room it's
    | actually a participant of, and to pull a fresh room:update /
    | room:text snapshot on demand (e.g. after a hard refresh). It is NOT
    | required anymore for room:start / countdown / go to reach a
    | participant — notifyParticipants() below handles that.
    |--------------------------------------------------------------------------
    */

    socket.on(
      'room:join',
      async ({ roomId }) => {
        console.log(
          '[room:join] EVENT RECEIVED. roomId =',
          roomId,
          'from',
          socket.user.username
        );

        try {
          const normalizedRoomId =
            String(roomId || '')
              .trim()
              .toUpperCase();

          if (!normalizedRoomId) {
            return socket.emit(
              'room:error',
              {
                message:
                  'Room ID is required',
              }
            );
          }

          const room =
            await Room.findOne({
              roomId:
                normalizedRoomId,
            });

          if (!room) {
            console.log(
              '[room:join] room not found:',
              normalizedRoomId
            );

            return socket.emit(
              'room:error',
              {
                message:
                  'Room not found',
              }
            );
          }

          /*
          |--------------------------------------------------------------------------
          | VERIFY PARTICIPANT
          |--------------------------------------------------------------------------
          */

          const isParticipant =
            room.participants.some(
              (participant) =>
                String(
                  participant.userId
                ) ===
                String(
                  socket.user._id
                )
            );

          if (!isParticipant) {
            console.log(
              '[room:join] user is not a participant'
            );

            return socket.emit(
              'room:error',
              {
                message:
                  'Join the room via the API first',
              }
            );
          }

          socket.data.roomId =
            room.roomId;

          console.log(
            '[room:join] SUCCESS for',
            socket.user.username,
            'room',
            room.roomId
          );

          /*
          |--------------------------------------------------------------------------
          | SEND CURRENT ROOM STATE (to this socket only — a snapshot)
          |--------------------------------------------------------------------------
          */

          socket.emit(
            'room:update',
            publicRoom(room)
          );

          socket.emit(
            'room:text',
            {
              text: room.text,
            }
          );
        } catch (error) {
          console.error(
            '[room:join] ERROR:',
            error
          );

          socket.emit(
            'room:error',
            {
              message:
                'Failed to load room',
            }
          );
        }
      }
    );

    /*
    |--------------------------------------------------------------------------
    | START RACE
    |--------------------------------------------------------------------------
    */

    socket.on(
      'room:start',
      async ({ roomId }) => {
        console.log(
          '[room:start] EVENT RECEIVED. roomId =',
          roomId,
          'from',
          socket.user.username
        );

        try {
          const normalizedRoomId =
            String(roomId || '')
              .trim()
              .toUpperCase();

          const room =
            await Room.findOne({
              roomId:
                normalizedRoomId,
            });

          if (!room) {
            console.log(
              '[room:start] room not found:',
              normalizedRoomId
            );

            return socket.emit(
              'room:error',
              {
                message:
                  'Room not found',
              }
            );
          }

          /*
          |--------------------------------------------------------------------------
          | OWNER CHECK
          |--------------------------------------------------------------------------
          */

          if (
            String(room.ownerId) !==
            String(socket.user._id)
          ) {
            console.log(
              '[room:start] REJECTED: not owner'
            );

            return socket.emit(
              'room:error',
              {
                message:
                  'Only the room owner can start the race',
              }
            );
          }

          /*
          |--------------------------------------------------------------------------
          | ROOM MUST BE WAITING
          |--------------------------------------------------------------------------
          */

          if (
            room.status !==
            'waiting'
          ) {
            console.log(
              '[room:start] REJECTED: status =',
              room.status
            );

            return socket.emit(
              'room:error',
              {
                message:
                  'This race has already started',
              }
            );
          }

          /*
          |--------------------------------------------------------------------------
          | CHANGE STATUS TO COUNTDOWN
          |--------------------------------------------------------------------------
          */

          room.status =
            'countdown';

          await room.save();

          console.log(
            '[room:start] COUNTDOWN STARTED:',
            room.roomId
          );

          /*
          |--------------------------------------------------------------------------
          | INFORM ALL PLAYERS (personal channels — reaches everyone
          | instantly regardless of room:join timing)
          |--------------------------------------------------------------------------
          */

          notifyParticipants(
            io,
            room,
            'room:update',
            publicRoom(room)
          );

          /*
          |--------------------------------------------------------------------------
          | 3 SECOND COUNTDOWN
          |--------------------------------------------------------------------------
          */

          let seconds = 3;

          notifyParticipants(
            io,
            room,
            'room:countdown',
            {
              seconds,
            }
          );

          console.log(
            `[room:countdown] ${room.roomId} → ${seconds}`
          );

          /*
          |--------------------------------------------------------------------------
          | COUNTDOWN TIMER
          |--------------------------------------------------------------------------
          */

          const countdownTimer =
            setInterval(
              async () => {
                try {
                  seconds -= 1;

                  /*
                  |--------------------------------------------------------------------------
                  | GO
                  |--------------------------------------------------------------------------
                  */

                  if (
                    seconds <= 0
                  ) {
                    clearInterval(
                      countdownTimer
                    );

                    const currentRoom =
                      await Room.findOne(
                        {
                          roomId:
                            room.roomId,
                        }
                      );

                    if (
                      !currentRoom
                    ) {
                      return;
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | SAFETY CHECK
                    |--------------------------------------------------------------------------
                    */

                    if (
                      currentRoom.status !==
                      'countdown'
                    ) {
                      console.log(
                        '[room:go] cancelled because status is:',
                        currentRoom.status
                      );

                      return;
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | START RACE
                    |--------------------------------------------------------------------------
                    */

                    currentRoom.status =
                      'racing';

                    currentRoom.startedAt =
                      new Date();

                    /*
                    | Reset player race data
                    */

                    currentRoom.participants.forEach(
                      (participant) => {
                        participant.progress = 0;
                        participant.wpm = 0;
                        participant.accuracy = 100;
                        participant.finished = false;
                        participant.finishedAt = null;
                      }
                    );

                    await currentRoom.save();

                    console.log(
                      '[room:go] RACE STARTED:',
                      currentRoom.roomId
                    );

                    /*
                    |--------------------------------------------------------------------------
                    | SEND GO TO EVERY PLAYER (personal channels)
                    |--------------------------------------------------------------------------
                    */

                    notifyParticipants(
                      io,
                      currentRoom,
                      'room:go',
                      {
                        text:
                          currentRoom.text,

                        startedAt:
                          currentRoom.startedAt,

                        duration:
                          currentRoom.duration,

                        mode:
                          currentRoom.mode,
                      }
                    );

                    /*
                    |--------------------------------------------------------------------------
                    | TIME MODE AUTO FINISH
                    |--------------------------------------------------------------------------
                    */

                    if (
                      currentRoom.mode ===
                      'time'
                    ) {
                      setTimeout(
                        async () => {
                          try {
                            const latestRoom =
                              await Room.findOne(
                                {
                                  roomId:
                                    currentRoom.roomId,
                                }
                              );

                            if (
                              latestRoom &&
                              latestRoom.status ===
                                'racing'
                            ) {
                              latestRoom.status =
                                'finished';

                              latestRoom.finishedAt =
                                new Date();

                              await latestRoom.save();

                              console.log(
                                '[room:timer] RACE FINISHED:',
                                latestRoom.roomId
                              );

                              notifyParticipants(
                                io,
                                latestRoom,
                                'room:ended',
                                publicRoom(
                                  latestRoom
                                )
                              );
                            }
                          } catch (error) {
                            console.error(
                              '[room:timer] ERROR:',
                              error
                            );
                          }
                        },

                        /*
                        | duration is in seconds
                        | + small safety margin
                        */

                        (currentRoom.duration +
                          1) *
                          1000
                      );
                    }

                    return;
                  }

                  /*
                  |--------------------------------------------------------------------------
                  | SEND 2 / 1
                  |--------------------------------------------------------------------------
                  */

                  notifyParticipants(
                    io,
                    room,
                    'room:countdown',
                    {
                      seconds,
                    }
                  );

                  console.log(
                    `[room:countdown] ${room.roomId} → ${seconds}`
                  );
                } catch (error) {
                  clearInterval(
                    countdownTimer
                  );

                  console.error(
                    '[room:countdown] ERROR:',
                    error
                  );

                  notifyParticipants(
                    io,
                    room,
                    'room:error',
                    {
                      message:
                        'The race could not start. Please try again.',
                    }
                  );
                }
              },

              1000
            );
        } catch (error) {
          console.error(
            '[room:start] ERROR:',
            error
          );

          socket.emit(
            'room:error',
            {
              message:
                'Failed to start race',
            }
          );
        }
      }
    );

    /*
    |--------------------------------------------------------------------------
    | RACE PROGRESS
    |--------------------------------------------------------------------------
    */

    socket.on(
      'race:progress',
      async ({
        roomId,
        progress,
        wpm,
        accuracy,
      }) => {
        try {
          const normalizedRoomId =
            String(roomId || '')
              .trim()
              .toUpperCase();

          const room =
            await Room.findOne({
              roomId:
                normalizedRoomId,
            });

          if (
            !room ||
            room.status !==
              'racing'
          ) {
            return;
          }

          const participant =
            room.participants.find(
              (player) =>
                String(
                  player.userId
                ) ===
                String(
                  socket.user._id
                )
            );

          if (!participant) {
            return;
          }

          participant.progress =
            Math.max(
              0,
              Math.min(
                100,
                Number(
                  progress || 0
                )
              )
            );

          participant.wpm =
            Math.max(
              0,
              Math.round(
                Number(
                  wpm || 0
                )
              )
            );

          participant.accuracy =
            Math.max(
              0,
              Math.min(
                100,
                Math.round(
                  Number(
                    accuracy ?? 100
                  )
                )
              )
            );

          await room.save();

          notifyParticipants(
            io,
            room,
            'race:update',
            {
              userId:
                socket.user._id,

              username:
                socket.user.username,

              progress:
                participant.progress,

              wpm:
                participant.wpm,

              accuracy:
                participant.accuracy,
            }
          );
        } catch (error) {
          console.error(
            '[race:progress] ERROR:',
            error
          );
        }
      }
    );

    /*
    |--------------------------------------------------------------------------
    | RACE FINISH
    |--------------------------------------------------------------------------
    */

    socket.on(
      'race:finish',
      async ({
        roomId,
        wpm,
        accuracy,
        chars,
      }) => {
        try {
          const normalizedRoomId =
            String(roomId || '')
              .trim()
              .toUpperCase();

          const room =
            await Room.findOne({
              roomId:
                normalizedRoomId,
            });

          if (!room) {
            return;
          }

          const participant =
            room.participants.find(
              (player) =>
                String(
                  player.userId
                ) ===
                String(
                  socket.user._id
                )
            );

          if (
            !participant ||
            participant.finished
          ) {
            return;
          }

          participant.finished =
            true;

          participant.finishedAt =
            new Date();

          participant.progress =
            100;

          participant.wpm =
            Math.max(
              0,
              Math.round(
                Number(
                  wpm || 0
                )
              )
            );

          participant.accuracy =
            Math.max(
              0,
              Math.min(
                100,
                Math.round(
                  Number(
                    accuracy ?? 100
                  )
                )
              )
            );

          await room.save();

          /*
          |--------------------------------------------------------------------------
          | SAVE RESULT
          |--------------------------------------------------------------------------
          */

          await TypingResult.create({
            userId:
              socket.user._id,

            mode:
              'tournament',

            wpm:
              participant.wpm,

            accuracy:
              participant.accuracy,

            chars:
              chars || 0,

            duration:
              room.duration,

            roomId:
              room.roomId,
          });

          /*
          |--------------------------------------------------------------------------
          | CALCULATE RANK
          |--------------------------------------------------------------------------
          */

          const finishedPlayers =
            room.participants
              .filter(
                (player) =>
                  player.finished
              )
              .sort(
                (a, b) =>
                  new Date(
                    a.finishedAt
                  ) -
                  new Date(
                    b.finishedAt
                  )
              );

          const rank =
            finishedPlayers.findIndex(
              (player) =>
                String(
                  player.userId
                ) ===
                String(
                  socket.user._id
                )
            ) + 1;

          /*
          |--------------------------------------------------------------------------
          | SEND FINISH EVENT
          |--------------------------------------------------------------------------
          */

          notifyParticipants(
            io,
            room,
            'race:playerFinished',
            {
              userId:
                socket.user._id,

              username:
                socket.user.username,

              wpm:
                participant.wpm,

              accuracy:
                participant.accuracy,

              rank,
            }
          );

          /*
          |--------------------------------------------------------------------------
          | EVERYONE FINISHED
          |--------------------------------------------------------------------------
          */

          const allDone =
            room.participants.every(
              (player) =>
                player.finished
            );

          if (allDone) {
            room.status =
              'finished';

            room.finishedAt =
              new Date();

            await room.save();

            notifyParticipants(
              io,
              room,
              'room:ended',
              publicRoom(room)
            );
          }
        } catch (error) {
          console.error(
            '[race:finish] ERROR:',
            error
          );

          socket.emit(
            'room:error',
            {
              message:
                'Failed to record your finish',
            }
          );
        }
      }
    );

    /*
    |--------------------------------------------------------------------------
    | KICK PLAYER (owner only)
    |--------------------------------------------------------------------------
    | The removed player gets a dedicated event on their OWN personal
    | channel (so it reaches them even though they're no longer in
    | room.participants by the time we broadcast); everyone else gets the
    | usual room:update with the shrunk participant list.
    |--------------------------------------------------------------------------
    */

    socket.on(
      'room:kick',
      async ({
        roomId,
        targetUserId,
      }) => {
        console.log(
          '[room:kick] EVENT RECEIVED. roomId =',
          roomId,
          'targetUserId =',
          targetUserId,
          'from',
          socket.user.username
        );

        try {
          const normalizedRoomId =
            String(roomId || '')
              .trim()
              .toUpperCase();

          const room =
            await Room.findOne({
              roomId:
                normalizedRoomId,
            });

          if (!room) {
            return socket.emit(
              'room:error',
              {
                message:
                  'Room not found',
              }
            );
          }

          if (
            String(room.ownerId) !==
            String(socket.user._id)
          ) {
            console.log(
              '[room:kick] REJECTED: not owner'
            );

            return socket.emit(
              'room:error',
              {
                message:
                  'Only the room owner can remove players',
              }
            );
          }

          if (
            String(targetUserId) ===
            String(room.ownerId)
          ) {
            return socket.emit(
              'room:error',
              {
                message:
                  'The owner cannot remove themselves',
              }
            );
          }

          const target =
            room.participants.find(
              (participant) =>
                String(
                  participant.userId
                ) ===
                String(targetUserId)
            );

          if (!target) {
            return;
          }

          room.participants =
            room.participants.filter(
              (participant) =>
                String(
                  participant.userId
                ) !==
                String(targetUserId)
            );

          await room.save();

          console.log(
            '[room:kick]',
            target.username,
            'removed from',
            room.roomId,
            'by',
            socket.user.username
          );

          io.to(
            `user:${targetUserId}`
          ).emit(
            'room:kicked',
            {
              roomId: room.roomId,
              message:
                'You were removed from this room by the host.',
            }
          );

          notifyParticipants(
            io,
            room,
            'room:update',
            publicRoom(room)
          );
        } catch (error) {
          console.error(
            '[room:kick] ERROR:',
            error
          );

          socket.emit(
            'room:error',
            {
              message:
                'Failed to remove player',
            }
          );
        }
      }
    );

    /*
    |--------------------------------------------------------------------------
    | REACTION
    |--------------------------------------------------------------------------
    */

    socket.on(
      'room:reaction',
      async ({
        roomId,
        emoji,
      }) => {
        if (
          !roomId ||
          !emoji
        ) {
          return;
        }

        try {
          const normalizedRoomId =
            String(roomId)
              .trim()
              .toUpperCase();

          const room =
            await Room.findOne({
              roomId:
                normalizedRoomId,
            });

          if (!room) return;

          notifyParticipants(
            io,
            room,
            'room:reaction',
            {
              username:
                socket.user.username,

              emoji:
                String(
                  emoji
                ).slice(0, 8),
            }
          );
        } catch (error) {
          console.error(
            '[room:reaction] ERROR:',
            error
          );
        }
      }
    );

    /*
    |--------------------------------------------------------------------------
    | DISCONNECT
    |--------------------------------------------------------------------------
    */

    socket.on(
      'disconnect',
      (reason) => {
        console.log(
          '[socket] disconnected, user =',
          socket.user?.username,
          'reason =',
          reason
        );
      }
    );
  });
};