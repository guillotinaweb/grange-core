import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import {
  AuthenticatedStatus,
  Error,
  PasswordResetInfo,
  UserInfoTokenParts,
  LoginToken,
} from './interfaces';
import { catchError, map, concatMap } from 'rxjs/operators';
import { ReCaptchaV3Service } from './recaptcha_v3.service';
import { ConfigurationService } from './configuration.service';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  isAuthenticated: BehaviorSubject<AuthenticatedStatus> = new BehaviorSubject({
    state: false,
    pending: false,
    username: null,
  });
  basicCredentials?: string[];

  constructor(
    protected config: ConfigurationService,
    protected http: HttpClient,
    protected recaptcha: ReCaptchaV3Service
  ) {
    let token = localStorage.getItem('auth');
    const lastLogin = localStorage.getItem('auth_time');
    // token expires after 12 hours
    const expire = config.get('AUTH_TOKEN_EXPIRES', 12 * 60 * 60 * 1000);
    if (!lastLogin || Date.now() - Date.parse(lastLogin) > expire) {
      localStorage.removeItem('auth');
      token = null;
    }
    if (token) {
      this.isAuthenticated.next({
        state: true,
        pending: false,
        username: this.getUsername(),
      });
    }
  }

  getUser(): Observable<any>  {
    const headers = this.getHeaders();
    return this.http
        .get(this.config.get('BACKEND_URL') + '/@users/' + this.getUsername(), {
            headers,
        });
  }

  getUsername(): string | null {
    const userTokenInfo = this.getUserTokenInfo();
    if (userTokenInfo === null) {
      return null;
    } else {
      return (
        userTokenInfo.username || userTokenInfo.sub || userTokenInfo.id || null
      );
    }
  }

  protected getUserTokenInfo(): UserInfoTokenParts | null {
    const token = localStorage.getItem('auth');
    if (token) {
      const tokenParts = token.split('.');
      return JSON.parse(atob(tokenParts[1])) as UserInfoTokenParts;
    } else {
      return null;
    }
  }

  setBasicCredentials(login: string, password: string, temporary = false) {
    this.basicCredentials = [login, password];
    this.isAuthenticated.next({
      state: !temporary,
      pending: temporary,
      username: login,
    });
  }

  cleanBasicCredentials() {
    delete this.basicCredentials;
    this.isAuthenticated.next({
      state: false,
      pending: false,
      username: null,
    });
  }

  setAuthToken(token: string) {
    localStorage.setItem('auth', token);
    localStorage.setItem('auth_time', new Date().toISOString());
    this.isAuthenticated.next({
      state: true,
      pending: false,
      username: this.getUsername(),
    });
  }

  getHeaders(recaptcha?: string): HttpHeaders {
    let headers = new HttpHeaders();
    headers = headers.set('Accept', 'application/json');
    headers = headers.set('Content-Type', 'application/json');
    const auth = localStorage.getItem('auth');
    if (auth) {
      headers = headers.set('Authorization', 'Bearer ' + auth);
    } else if (!!this.basicCredentials) {
      headers = headers.set(
        'Authorization',
        'Basic ' + btoa(this.basicCredentials.join(':'))
      );
    }
    if (recaptcha) {
      headers = headers.set('X-VALIDATION-G', recaptcha);
    }
    return headers;
  }

  setAuthenticated(isAuthenticated: boolean): void {
    this.isAuthenticated.next({
      state: isAuthenticated,
      pending: false,
      username: this.getUsername(),
    });
  }

  protected error(errorResponse: HttpErrorResponse): Observable<Error> {
    const error: Error = getError(errorResponse);
    return throwError(error);
  }

  // LOGIN LOGIC

  login(login: string, password: string, path?: string): Observable<any> {
    if (this.config.get('RECAPTCHA_TOKEN')) {
      const promise = this.recaptcha.executeAsPromise(
        this.config.get('RECAPTCHA_TOKEN'),
        'login'
      );
      return from(promise).pipe(
        concatMap((token: string) => {
          return this.doLogin(login, password, path, token);
        }),
        catchError((err) => {
          return throwError(err);
        })
      );
    } else {
      return this.doLogin(login, password, path);
    }
  }

  doLogin(
    login: string,
    password: string,
    path?: string,
    recaptcha?: string
  ): Observable<any> {
    const headers = this.getHeaders(recaptcha);
    const body = JSON.stringify({
      login,
      password,
    });
    return this.http
      .post(this.config.get('BACKEND_URL') + (path || '') + '/@login', body, {
        headers,
      })
      .pipe(
        map((data: LoginToken) => {
          if (data.token) {
            this.setAuthToken(data.token);
            return true;
          } else {
            localStorage.removeItem('auth');
            localStorage.removeItem('auth_time');
            this.isAuthenticated.next({
              state: false,
              pending: false,
              username: null,
            });
            return false;
          }
        }),
        catchError((errorResponse: HttpErrorResponse) => {
          const error = getError(errorResponse);
          if (errorResponse.status === 404) {
            // @login endpoint does not exist on this backend
            // we keep with basic auth
            this.setBasicCredentials(login, password, false);
          } else {
            localStorage.removeItem('auth');
            localStorage.removeItem('auth_time');
            this.isAuthenticated.next({
              state: false,
              pending: false,
              username: null,
              error: error.message,
            });
          }
          return throwError(error);
        })
      );
  }

  // LOGOUT LOGIC

  _logout() {
    this.cleanBasicCredentials();
    localStorage.removeItem('auth');
    localStorage.removeItem('auth_time');
    this.isAuthenticated.next({ state: false, pending: false, username: null });
  }

  logout() {
    const headers = this.getHeaders();
    const url = this.config.get('BACKEND_URL') + `/@logout`;
    this.http
      .post(url, {}, { headers })
      .pipe(catchError(this.error.bind(this)))
      .subscribe(
        (res) => {
          this._logout();
        },
        (err) => {
          this._logout();
        }
      );
  }

  // REGISTER

  doRegister(user: any, recaptcha?: string): Observable<any> {
    const headers = this.getHeaders(recaptcha);
    const url = this.config.get('BACKEND_URL') + `/@users`;
    return this.http
      .post(url, user, { headers })
      .pipe(catchError(this.error.bind(this)));
  }

  // RESET PASSWORD LOGIN

  doRequestPasswordReset(login: string, recaptcha?: string): Observable<any> {
    const headers = this.getHeaders(recaptcha);
    const url =
      this.config.get('BACKEND_URL') + `/@users/${login}/reset-password`;
    return this.http
      .post(url, {}, { headers })
      .pipe(catchError(this.error.bind(this)));
  }

  requestPasswordReset(login: string): Observable<any> {
    if (this.config.get('RECAPTCHA_TOKEN')) {
      const promise = this.recaptcha.executeAsPromise(
        this.config.get('RECAPTCHA_TOKEN'),
        'reset'
      );
      return from(promise).pipe(
        concatMap((token: string) => {
          return this.doRequestPasswordReset(login, token);
        }),
        catchError((err) => {
          return throwError(err);
        })
      );
    } else {
      return this.doRequestPasswordReset(login);
    }
  }

  // CHANGE PASSWORD

  passwordReset(resetInfo: PasswordResetInfo): Observable<any> {
    const headers = this.getHeaders();
    const data: { [key: string]: string } = {
      new_password: resetInfo.newPassword,
    };
    if (resetInfo.oldPassword) {
      data['old_password'] = resetInfo.oldPassword;
    }
    if (resetInfo.token) {
      data['reset_token'] = resetInfo.token;
    }
    const url =
      this.config.get('BACKEND_URL') +
      `/@users/${resetInfo.login}/reset-password`;
    return this.http
      .post(url, data, { headers })
      .pipe(catchError(this.error.bind(this)));
  }

  goSocialLogin(provider, callback): void {
    const callUrl = `${this.config.get(
      'BACKEND_URL'
    )}/@authenticate/${provider}?callback=${
      location.origin
    }/${callback}${provider}`;
    window.location.href = callUrl;
  }

  // VALIDATION LOGIC

  doGetValidationSchema(token: string, recaptcha?: string): Observable<any> {
    const headers = this.getHeaders(recaptcha);
    const url = this.config.get('BACKEND_URL') + `/@validate_schema/${token}`;
    return this.http
      .post(url, {}, { headers })
      .pipe(catchError(this.error.bind(this)));
  }

  getValidationSchema(token: string): Observable<any> {
    if (this.config.get('RECAPTCHA_TOKEN')) {
      const promise = this.recaptcha.executeAsPromise(
        this.config.get('RECAPTCHA_TOKEN'),
        'schema'
      );
      return from(promise).pipe(
        concatMap((recaptcha: string) => {
          return this.doGetValidationSchema(token, recaptcha);
        }),
        catchError((err) => {
          return throwError(err);
        })
      );
    } else {
      return this.doGetValidationSchema(token);
    }
  }

  doRealValidation(
    token: string,
    model: any,
    recaptcha?: string
  ): Observable<any> {
    const headers = this.getHeaders(recaptcha);
    const url = this.config.get('BACKEND_URL') + `/@validate/${token}`;
    return this.http
      .post(url, model, { headers })
      .pipe(catchError(this.error.bind(this)));
  }

  doValidation(token: string, model: any): Observable<any> {
    if (this.config.get('RECAPTCHA_TOKEN')) {
      const promise = this.recaptcha.executeAsPromise(
        this.config.get('RECAPTCHA_TOKEN'),
        'validation'
      );
      return from(promise).pipe(
        concatMap((recaptcha: string) => {
          return this.doRealValidation(token, model, recaptcha);
        }),
        catchError((err) => {
          return throwError(err);
        })
      );
    } else {
      return this.doRealValidation(token, model);
    }
  }

  doGetInfo(recaptcha?: string) {
    const headers = this.getHeaders(recaptcha);
    const url = this.config.get('BACKEND_URL') + `/@info`;
    return this.http
      .get(url, { headers })
      .pipe(catchError(this.error.bind(this)));
  }

  getInfo(): Observable<any> {
    if (this.config.get('RECAPTCHA_TOKEN')) {
      const promise = this.recaptcha.executeAsPromise(
        this.config.get('RECAPTCHA_TOKEN'),
        'info'
      );
      return from(promise).pipe(
        concatMap((recaptcha: string) => {
          return this.doGetInfo(recaptcha);
        }),
        catchError((err) => {
          return throwError(err);
        })
      );
    } else {
      return this.doGetInfo();
    }
  }
}

export function getError(errorResponse: HttpErrorResponse): Error {
  let error: Error;
  if (errorResponse.error) {
    let errorResponseError: any = errorResponse.error;
    try {
      // string plone error
      errorResponseError = JSON.parse(errorResponseError);
      if (errorResponseError.error && errorResponseError.error.message) {
        // two levels of error properties
        error = Object.assign({}, errorResponseError.error);
      } else {
        error = errorResponseError;
      }
    } catch (SyntaxError) {
      if (errorResponseError.message && errorResponseError.type) {
        // object plone error
        error = errorResponseError;
      } else if (
        typeof errorResponseError.error === 'object' &&
        errorResponseError.error.type
      ) {
        // object plone error with two levels of error properties
        error = Object.assign({}, errorResponseError.error);
      } else {
        // not a plone error
        error = {
          type: errorResponse.statusText,
          message: errorResponse.message,
          traceback: [],
        };
      }
    }
  } else {
    error = {
      type: errorResponse.statusText,
      message: errorResponse.message,
      traceback: [],
    };
  }
  // check if message is a jsonified list
  try {
    const parsedMessage = JSON.parse(error.message);
    if (Array.isArray(parsedMessage)) {
      // a list of errors - dexterity validation error for instance
      error.errors = parsedMessage;
      error.message = errorResponse.message;
    }
  } catch (SyntaxError) {
    //
  }
  error.response = errorResponse;
  return error;
}
