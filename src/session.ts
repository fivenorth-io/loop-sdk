import { generateRequestId } from './provider';

const STORAGE_KEY_LOOP_CONNECT = 'loop_connect';

/**
 * Session LifeCycle:
 * 1. Initialize a new session with a session id
 * 2. Set the ticket id when we exchange session id/appname, and user approve it and now we have a ticket id
 * 3. Set the session as authorized when we succesfully validate the session with the backend
 * 4. Save the session to localStorage
 * 5. Reset the session when we need to start a new session
 * 6. Validate the session when we need to check if the session is valid
 * 7. Is authorized means the session is valid and the user is authenticated
 * 8. Save the session to localStorage
 */
export class SessionInfo  {
  public sessionId: string;
  public ticketId?: string;
  public authToken?: string;
  public partyId?: string;
  public publicKey?: string;
  public email?: string;
  public userApiKey?: string;
  private _isAuthorized: boolean = false;

  constructor({ sessionId, ticketId, authToken, partyId, publicKey, email, userApiKey }: {  sessionId: string, ticketId?: string, authToken?: string, partyId?: string, publicKey?: string, email?: string, userApiKey?: string }) {
    this.sessionId = sessionId;
    this.ticketId = ticketId;
    this.authToken = authToken;
    this.partyId = partyId;
    this.publicKey = publicKey;
    this.email = email;
    this.userApiKey = userApiKey;
  }

  // set the ticket id when we exchange session id/appname, and user approve it and now we have a ticket id
  setTicketId(ticketId: string): void {
    this.ticketId = ticketId;
    this.save()
  }

  // set the session as authorized when we succesfully validate the session with the backend
  authorized(): void {
    if (this.ticketId === undefined || this.sessionId === undefined || this.authToken === undefined || this.partyId === undefined || this.publicKey === undefined) {
      throw new Error('Session cannot be authorized without all required fields.');
    }
    this._isAuthorized = true;
  }

  // is pre authorized means the session is initialized and the ticket id is set together with auth and user information but we haven't validated the session with the backend yet
  isPreAuthorized(): boolean {
    return !this._isAuthorized && this.ticketId !== undefined && this.sessionId !== undefined && this.authToken !== undefined && this.partyId !== undefined && this.publicKey !== undefined;
  }

  // is authorized means the session is valid and the user is authenticated
  isAuthorized(): boolean {
    return this._isAuthorized;
  }

  // save persisted session info to localStorage
  save(): void {
    localStorage.setItem('loop_connect', this.toJson());
  }


  reset(): void {
    localStorage.removeItem(STORAGE_KEY_LOOP_CONNECT);

    this.sessionId = generateRequestId();

    this._isAuthorized = false;
    this.ticketId = undefined;
    this.authToken = undefined;
    this.partyId = undefined;
    this.publicKey = undefined;
    this.email = undefined;
  }

  static fromStorage(): SessionInfo {
    const existingConnectionRaw = localStorage.getItem(STORAGE_KEY_LOOP_CONNECT);

    if (!existingConnectionRaw) {
      return new SessionInfo({ sessionId: generateRequestId() });
    }

    let session: SessionInfo | null = null;

    try {
      session = new SessionInfo(JSON.parse(existingConnectionRaw));
    } catch (error) {
      console.error('Failed to parse existing connection info, local storage is corrupted.', error);
      localStorage.removeItem(STORAGE_KEY_LOOP_CONNECT);

      session = new SessionInfo({ sessionId: generateRequestId() });
    }

    return session;
  }

  private toJson(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      ticketId: this.ticketId,
      authToken: this.authToken,
      partyId: this.partyId,
      publicKey: this.publicKey,
      email: this.email,
    });
  }
}