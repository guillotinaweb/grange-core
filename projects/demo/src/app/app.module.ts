import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
    declarations: [
        AppComponent
    ],
    imports: [
        BrowserModule,
        HttpClientModule,
    ],
    providers: [
        {
            provide: 'CONFIGURATION', useValue: {
                BACKEND_URL: 'http://0.0.0.0:8081',
            }
        },
        { provide: 'LANG', useValue: 'en_US' },
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
