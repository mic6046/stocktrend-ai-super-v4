import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { apiUrl, loggedFetch } from './api';
import { userDocId } from './userData';
import type { HelpTopic } from './helpForm';

export type HelpRequestPayload = {
  email: string;
  topic: HelpTopic;
  subject: string;
  message: string;
  page?: string | null;
};

function userDocIdSafe(email: string): string {
  try {
    return userDocId(email);
  } catch {
    return email.trim().toLowerCase();
  }
}

export async function submitHelpRequest(payload: HelpRequestPayload): Promise<{ id: string }> {
  const email = payload.email.trim().toLowerCase();
  const subject = payload.subject.trim();
  const message = payload.message.trim();
  if (!email.includes('@')) throw new Error('Enter a valid email.');
  if (subject.length < 3) throw new Error('Subject is too short.');
  if (message.length < 10) throw new Error('Please describe the issue in a bit more detail.');

  const body = {
    email,
    topic: payload.topic,
    subject: subject.slice(0, 200),
    message: message.slice(0, 4000),
    page: payload.page || null,
    status: 'open',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 240) : null,
    createdAt: serverTimestamp(),
  };

  const inbox = await addDoc(collection(db, 'users', userDocIdSafe(email), 'helpRequests'), body);

  try {
    await addDoc(collection(db, 'helpRequests'), {
      ...body,
      userPath: inbox.path,
    });
  } catch {
    /* top-level inbox needs deployed rules — user copy is enough */
  }

  try {
    await loggedFetch(apiUrl('/api/help'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        topic: payload.topic,
        subject: body.subject,
        message: body.message,
        page: body.page,
        clientId: inbox.id,
      }),
      __qnMeta: { reason: 'help-form', userAction: 'Submit help request' },
    });
  } catch {
    /* Cloud Run may not have the route yet — Firestore write already saved */
  }

  return { id: inbox.id };
}
