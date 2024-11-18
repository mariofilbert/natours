/* eslint-disable */
import '@babel/polyfill';
import { displayMap } from './leaflet';
import { login, logout } from './login';
import { updateSettings } from './updateSettings';
import { bookTour } from './stripe';
import { showAlert } from './alerts';

// console.log('Hello from parcel !');

// DOM ELEMENTS
const mapBox = document.getElementById('map');
const loginForm = document.querySelector('.form--login');
const logOutBtn = document.querySelector('.nav__el--logout');
const userDataForm = document.querySelector('.form-user-data');
const userPasswordForm = document.querySelector('.form-user-password');
const bookBtn = document.getElementById('book-tour');

//DELEGATION
if (mapBox) {
  // Get locations from HTML
  const locations = JSON.parse(mapBox.dataset.locations);
  // console.log(locations);
  displayMap(locations);
}

if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    login(email, password);
  });
}

if (logOutBtn) {
  logOutBtn.addEventListener('click', logout);
}

if (userDataForm) {
  let userPhotoUrl;

  document.querySelector('#photo').addEventListener('change', function (e) {
    const [file] = e.target.files;
    // console.log(file);
    if (file && file.type.startsWith('image')) {
      const userPhoto = document.querySelector('.form__user-photo');

      userPhotoUrl = URL.createObjectURL(file);
      userPhoto.src = userPhotoUrl;
    }
  });

  userDataForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.querySelector('.btn--green');
    submitBtn.textContent = 'Updating...';

    const form = new FormData();
    form.append('name', document.getElementById('name').value);
    form.append('email', document.getElementById('email').value);
    form.append('photo', document.getElementById('photo').files[0]);

    // for (const value of form.values()) {
    //   console.log(value);
    // }

    const isSucessful = await updateSettings(form, 'data');

    // console.log('isSucessful:', isSucessful);
    // console.log('userPhotoUrl:', userPhotoUrl);

    if (isSucessful && userPhotoUrl) {
      document.querySelector('.nav__user-img').src = userPhotoUrl;
      submitBtn.textContent = 'Save Settings';
    }

    // console.log(form);
    // const name = document.getElementById('name').value;
    // const email = document.getElementById('email').value;

    // updateSettings(form, `data`);
  });
}

if (userPasswordForm) {
  userPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    document.querySelector(`.btn--save-password`).textContent = 'Updating...';

    const passwordCurrent = document.getElementById('password-current').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;

    await updateSettings(
      { passwordCurrent, password, passwordConfirm },
      `password`,
    );

    document.querySelector(`.btn--save-password`).textContent = 'Save password';
    document.getElementById('password-current').value = '';
    document.getElementById('password').value = '';
    document.getElementById('password-confirm').value = '';
  });
}

if (bookBtn) {
  bookBtn.addEventListener('click', (e) => {
    e.target.textContent = 'Processing...';
    // event target is the element which was clicked (in this case the data attribute in the button coming from the tour.pug line 100 --> data-tour-id)
    const tourId = e.target.dataset.tourId;
    bookTour(tourId);
  });
}

if (showAlert) {
  const alertMessage = document.querySelector('body').dataset.alert;
  if (alertMessage) showAlert('success', alertMessage, 15);
}
