import { Firestore } from '@google-cloud/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

async function test() {
  console.log('Firebase Config ProjectId:', firebaseConfig.projectId);
  console.log('Firebase Config DatabaseId:', firebaseConfig.firestoreDatabaseId);

  try {
    const db = new Firestore({
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId
    });
    const snap = await db.collection('tenants').limit(1).get();
    console.log('Success! Found docs:', snap.size);
  } catch (err: any) {
    console.error('Failed:', err.message || err);
  }
}

test();
