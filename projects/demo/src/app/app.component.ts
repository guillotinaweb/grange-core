import { Component, OnInit } from '@angular/core';
import { AuthenticationService, ResourceService } from 'grange-core';
import { concatMap } from 'rxjs/operators';
import { forkJoin } from 'rxjs';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
    isLogged = this.auth.isAuthenticated;
    containers: any[] = [];

    constructor(
        private auth: AuthenticationService,
        private resources: ResourceService,
    ) {}

    ngOnInit() {
        this.auth.isAuthenticated.subscribe(auth => {
            if (auth.state) {
                this.refresh();
            }
        });
    }

    refresh() {
        this.resources.get('/db').pipe(
            concatMap(res => forkJoin(res.containers.map(id => this.resources.get(`/db/${id}`))))
        ).subscribe(containers => this.containers = containers);
    }

    deleteContainer(path: string) {
        this.resources.delete(path).subscribe(() => this.refresh());
    }

    login() {
        this.auth.login('root', 'root').subscribe();
    }

    logout() {
        this.auth.logout();
    }

    addContainer() {
        const uid = (new Date()).getTime();
        this.resources.create('/db', {
            id: `container-${uid}`,
            title: `Container ${uid}`,
            '@type': 'Container',
        }).subscribe(() => this.refresh());
    }
}
