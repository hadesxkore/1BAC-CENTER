// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app"
import { getAnalytics } from "firebase/analytics"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDhUM4YjpTkNirKKSvZbS2gloC_-ASRABs",
  authDomain: "bac-center.firebaseapp.com",
  projectId: "bac-center",
  storageBucket: "bac-center.firebasestorage.app",
  messagingSenderId: "1089799928580",
  appId: "1:1089799928580:web:23fd2130ad0901f84a2e51",
  measurementId: "G-Z9H89X3MDM"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
const analytics = getAnalytics(app)
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)

export { app, analytics, auth, db, storage }
