/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

const Stripe = require('stripe');

const stripe = Stripe(
  'pk_test_51QGZTzKQzZ7HzleA9EKFi5K8kusKJU1iotRafOzBoxMK3cT5jXnNvdoFKVBvAVvHwVsH954Dy70jOWxhyoZfuTsj00H3aK7t0V',
);

export const bookTour = async (tourId) => {
  try {
    // 1) Get checkout session from API
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);

    // console.log(session);

    // 2) Redirect to checkout page
    window.location.assign(session.data.session.url);

    // No longer needed as stripe generates the checkout address in the data.session.ul
    // // 2) Create chekout from + charge credit card}
    // await stripe.redirectToCheckout({
    //   //coming from the axios response of line 14
    //   sessionId: session.data.session.id,
    // });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
