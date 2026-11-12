
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL,
  timeout: 15000,
});

// Attach JWT to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tf_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Normalize API errors.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!err.response) {
      err.friendlyMessage =
        'Cannot reach the server. Please check your internet connection or backend availability.';
    } else {
      const status = err.response.status;
      const serverMsg =
        err.response.data?.message || err.response.data?.error;

      if (status === 401)
        err.friendlyMessage = serverMsg || 'Your session has expired. Please log in again.';
      else if (status === 403)
        err.friendlyMessage = serverMsg || "You don't have permission to do that.";
      else if (status === 404)
        err.friendlyMessage = serverMsg || 'That resource could not be found.';
      else if (status === 409)
        err.friendlyMessage = serverMsg || 'That already exists.';
      else if (status >= 500)
        err.friendlyMessage = serverMsg || 'Something went wrong on the server.';
      else
        err.friendlyMessage = serverMsg || 'Something went wrong.';
    }

    return Promise.reject(err);
  }
);

export default api;
