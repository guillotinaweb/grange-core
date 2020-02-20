// Code refactored from ngx-captcha package because was not released with promise call
import { Injectable, Inject, NgZone } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ReCaptchaV3Service {

    protected readonly windowGrecaptcha = 'grecaptcha';

    protected readonly windowOnLoadCallbackProperty = 'ngx_captcha_onload_callback';

    protected readonly globalDomain: string = 'recaptcha.net';

    protected readonly defaultDomain: string = 'google.com';

    constructor(
        protected zone: NgZone,
        @Inject('LANG') protected lang: any,
    ) {
    }

    registerCaptchaScript(useGlobalDomain: boolean, render: string, onLoad: (grecaptcha: any) => void, language?: string): void {
        if (this.grecaptchaScriptLoaded()) {
            // recaptcha script is already loaded
            // just call the callback
            this.zone.run(() => {
                onLoad(window[this.windowGrecaptcha]);
            });
            return;
        }

        // we need to patch the callback through global variable, otherwise callback is not accessible
        // note: https://github.com/Enngage/ngx-captcha/issues/2
        window[this.windowOnLoadCallbackProperty] = <any>(() => this.zone.run(
            onLoad.bind(this, window[this.windowGrecaptcha])
        ));

        // prepare script elem
        const scriptElem = document.createElement('script');
        scriptElem.innerHTML = '';
        scriptElem.src = this.getCaptchaScriptUrl(useGlobalDomain, render, language);
        scriptElem.async = true;
        scriptElem.defer = true;

        // add script to header
        document.getElementsByTagName('head')[0].appendChild(scriptElem);
    }

    cleanup(): void {
        window[this.windowOnLoadCallbackProperty] = undefined;
        window[this.windowGrecaptcha] = undefined;
    }

    private grecaptchaScriptLoaded(): boolean {
        if (window[this.windowOnLoadCallbackProperty] && window[this.windowGrecaptcha]) {
            return true;
        }
        return false;
    }

    private getLanguageParam(hl?: string): string {
        if (!hl) {
            return '';
        }

        return `&hl=${hl}`;
    }

    private getCaptchaScriptUrl(useGlobalDomain: boolean, render: string, language?: string): string {
        const domain = useGlobalDomain ? this.globalDomain : this.defaultDomain;

        // tslint:disable-next-line:max-line-length
        return `https://www.${domain}/recaptcha/api.js?onload=${this.windowOnLoadCallbackProperty}&render=${render}${this.getLanguageParam(language)}`;
    }

    executeAsPromise(
      siteKey: string,
      action: string,
      config?: {
        useGlobalDomain: boolean;
      }
    ): Promise<string> {
      return new Promise((resolve, reject) => {
        const useGlobalDomain = config && config.useGlobalDomain ? true : false;

        const onRegister = grecaptcha => {
          this.zone.runOutsideAngular(() => {
            grecaptcha
              .execute(siteKey, {
                action: action,
              })
              .then(token => {
                this.zone.run(() => {
                  resolve(token);
                });
              })
          });
        };

        this.registerCaptchaScript(
          useGlobalDomain,
          siteKey,
          onRegister,
          this.lang
        );
      });
    }

    execute(
      siteKey: string,
      action: string,
      callback: (token: string) => void,
      config?: {
        useGlobalDomain: boolean;
      }
    ): void {
      this.executeAsPromise(siteKey, action, config).then(callback);
    }
}
