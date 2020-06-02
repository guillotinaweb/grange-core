import { Injectable } from '@angular/core';
import { APIService } from './api.service';
import { AuthenticationService } from './authentication.service';
import { CacheService } from './cache.service';
import { LoadingService } from './loading.service';
import { ResourceService } from './resource.service';
import { WebsocketService } from './websocket.service';

@Injectable({
    providedIn: 'root'
})
export class GrangeCore {

    constructor(
        public api: APIService,
        public auth: AuthenticationService,
        public cache: CacheService,
        public loading: LoadingService,
        public resource: ResourceService,
        public websocket: WebsocketService,
    ) { }
}
