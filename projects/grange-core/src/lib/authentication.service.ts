import {
    HttpClient,
    HttpErrorResponse,
    HttpHeaders,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthenticatedStatus, Error, PasswordResetInfo, UserInfoTokenParts, LoginToken } from './interfaces';
import { tap, catchError } from 'rxjs/operators';
import { ConfigurationService } from './configuration.service';

@Injectable({
    providedIn: 'root'
})
export class AuthenticationService {
    isAuthenticated: BehaviorSubject<AuthenticatedStatus> = new BehaviorSubject(
        { state: false, pending: false, username: null },
    );
    basicCredentials?: string[];

    constructor(
        protected config: ConfigurationService,
        protected http: HttpClient,
    ) {
        let token = localStorage.getItem('auth');
        const lastLogin = localStorage.getItem('auth_time');
        // token expires after 12 hours
        const expire = config.get(
            'AUTH_TOKEN_EXPIRES',
            12 * 60 * 60 * 1000,
        );
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

    getUsername(): string | null {
        const userTokenInfo = this.getUserTokenInfo();
        if (userTokenInfo === null) {
            return null;
        } else {
            return userTokenInfo.username || userTokenInfo.sub || userTokenInfo.id || null;
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

    login(login: string, password: string, path?: string): Observable<any> {
        const headers = this.getHeaders();
        const body = JSON.stringify({
            login: login,  // on plone.restapi login endpoint, username key is login
            password: password,
        });
        return this.http
            .post(this.config.get('BACKEND_URL') + (path || '') + '/@login', body, {
                headers: headers,
            }).pipe(
                tap((data: LoginToken) => {
                    if (data.token) {
                        localStorage.setItem('auth', data['token']);
                        localStorage.setItem(
                            'auth_time',
                            new Date().toISOString(),
                        );
                        this.isAuthenticated.next({
                            state: true,
                            pending: false,
                            username: this.getUsername(),
                        });
                    } else {
                        localStorage.removeItem('auth');
                        localStorage.removeItem('auth_time');
                        this.isAuthenticated.next({
                            state: false,
                            pending: false,
                            username: null,
                        });
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
                    return Observable.throw(error);
                })
            );
    }

    logout() {
        this.cleanBasicCredentials();
        localStorage.removeItem('auth');
        localStorage.removeItem('auth_time');
        this.isAuthenticated.next({ state: false, pending: false, username: null });
    }

    requestPasswordReset(login: string): Observable<any> {
        const headers = this.getHeaders();
        const url =
            this.config.get('BACKEND_URL') + `/@users/${login}/reset-password`;
        return this.http
            .post(url, {}, { headers: headers })
            .pipe(
                catchError(this.error.bind(this))
            );
    }

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
            .post(url, data, { headers: headers })
            .pipe(
                catchError(this.error.bind(this))
            );
    }

    getHeaders(): HttpHeaders {
        let headers = new HttpHeaders();
        headers = headers.set('Accept', 'application/json');
        headers = headers.set('Content-Type', 'application/json');
        const auth = localStorage.getItem('auth');
        if (auth) {
            headers = headers.set('Authorization', 'Bearer ' + auth);
        } else if (!!this.basicCredentials) {
            headers = headers.set('Authorization', 'Basic ' + btoa(this.basicCredentials.join(':')));
        }
        return headers;
    }

    setAuthenticated(isAuthenticated: boolean) {
        this.isAuthenticated.next({ state: isAuthenticated, pending: false, username: this.getUsername() });
    }

    protected error(errorResponse: HttpErrorResponse): Observable<Error> {
        const error: Error = getError(errorResponse);
        return Observable.throw(error);
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
        if (Array.isArray(parsedMessage)) { // a list of errors - dexterity validation error for instance
            error.errors = parsedMessage;
            error.message = errorResponse.message;
        }
    } catch (SyntaxError) {
        //
    }
    error.response = errorResponse;
    return error;
}
