import { Injectable } from '@angular/core';
import { APIService } from './api.service';
import { ConfigurationService } from './configuration.service';
import { AsyncSubject, Observable, Subject } from 'rxjs';

@Injectable({providedIn: 'root'})
export class WebsocketService {
    token: AsyncSubject<string> = new AsyncSubject();

    constructor(
        private api: APIService,
        private config: ConfigurationService,
    ) {
        this.api.get(this.config.get('BACKEND_URL') + '/@wstoken').subscribe(res => {
            this.token.next(res.token);
            this.token.complete();
        });
    }

    subscribeTo(path: string): Observable<any> {
        const subject: Subject<any> = new Subject();
        this.token.subscribe(token => {
            const fullPath = this.api.getFullPath(path);
            const url = 'ws://' + fullPath.split('//')[1] + '/@ws-edit?ws_token=' + token;
            const socket = new WebSocket(url);
            socket.onmessage = (msg) => {
                subject.next(msg.data);
            };
        });
        return subject;
    }
}
