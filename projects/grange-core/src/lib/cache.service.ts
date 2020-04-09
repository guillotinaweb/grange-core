import { EventEmitter, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { APIService } from './api.service';
import { AuthenticationService } from './authentication.service';

import { ConfigurationService } from './configuration.service';
import { map, publishReplay, refCount, take } from 'rxjs/operators';


@Injectable({
    providedIn: 'root'
})
export class CacheService {

    private cache: { [key: string]: Observable<any> } = {};
    private refreshDelay: number;
    private maxSize: number;
    public revoke: EventEmitter<string | null> = new EventEmitter();
    public hits: { [key: string]: number } = {};

    constructor(
        protected auth: AuthenticationService,
        protected api: APIService,
        protected config: ConfigurationService
    ) {
        this.auth.isAuthenticated.subscribe(() => {
            this.revoke.emit();
        });
        this.refreshDelay = this.config.get('CACHE_REFRESH_DELAY', 10000);
        this.maxSize = this.config.get('CACHE_MAX_SIZE', 1000);
        this.revoke.subscribe((revoked: string | null) => {
            if (!revoked) {
                this.cache = {};
                this.hits = {};
            } else if (typeof revoked === 'string') {
                delete this.cache[revoked];
                delete this.hits[revoked];
            }
        });
    }

    /*
     * gets an observable
     * that broadcasts a ReplaySubject
     * which emits the response of a get request
     * during service.refreshDelay ms without sending a new http request
     */
    public get<T>(url: string): Observable<T> {
        const service = this;
        const fullUrl = service.api.getFullPath(url);
        if (!service.cache.hasOwnProperty(fullUrl)) {
            if (Object.keys(service.cache).length >= service.maxSize) {
                // TODO: do not revoke everything
                this.revoke.emit();
            }
            service.cache[fullUrl] = service.api.get(fullUrl).pipe(
                // set hits to 0 each time request is actually sent
                map((observable: Observable<T>) => {
                    service.hits[fullUrl] = 0;
                    return observable;
                }),
                // create a ReplaySubject that stores and emit last response during delay
                publishReplay(1, service.refreshDelay),
                // broadcast ReplaySubject
                refCount(),
                // complete each observer after response has been emitted
                take(1),
                // increment hits each time request is subscribed
                map((observable: Observable<T>) => {
                    const hits = this.hits[fullUrl];
                    service.hits[fullUrl] = hits ? hits + 1 : 1;
                    return observable;
                })
            );
        }
        return service.cache[fullUrl];
    }

    /*
     Make the observable revoke the cache when it emits
     */
    public revoking<T>(observable: Observable<T>, revoked?: string | null): Observable<T> {
        const service = this;
        return observable.pipe(
            map((val: T): T => {
                service.revoke.emit(revoked);
                return val;
            })
        );
    }

}
