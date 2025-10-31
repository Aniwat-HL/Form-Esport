const firebaseConfig = {
  apiKey: "AIzaSyBqnVyK9BeJqMKuyYCqXzGOd1-07eEltEI",
  authDomain: "form-esport.firebaseapp.com",
  projectId: "form-esport",
  storageBucket: "form-esport.firebasestorage.app",
  messagingSenderId: "846451064511",
  appId: "1:846451064511:web:67cdec6e10d527396a900a",
  measurementId: "G-GQZ8RK4JTC"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

console.log('Firebase connected!');
