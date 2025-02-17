/* eslint-disable */

//updateData function
import { showAlert } from './alerts';
import axios from 'axios';

// type is either password or data
export const updateSettings = async (data, type) => {
  try {
    const url =
      type === 'password'
        ? '/api/v1/users/updateMyPassword'
        : '/api/v1/users/updateMe';

    const res = await axios({
      method: 'PATCH',
      url: url,
      data,
    });

    if ((res.data.status = 'success')) {
      showAlert('success', `${type.toUpperCase()} Updated Successfully`);

      // in order to make line 71 of index.js work
      return res.data.status;
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};
