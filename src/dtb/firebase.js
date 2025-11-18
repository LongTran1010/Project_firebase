import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBruwH3rURlPKRX1S5tDTDhyyiNGvMy2Ew",
  authDomain: "nhom100htn.firebaseapp.com",
  databaseURL: "https://nhom100htn-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nhom100htn",
  storageBucket: "nhom100htn.firebasestorage.app",
  messagingSenderId: "1002385846227",
  appId: "1:1002385846227:web:7c3324de29fcb8222d0926"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);
