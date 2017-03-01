import $ from 'jquery';
import { set } from 'lodash';

export default function (chrome, internals) {

  chrome.getXsrfToken = function () {
    return internals.version;
  };

  $.ajaxPrefilter(function ({ kbnXsrfToken = true }, originalOptions, jqXHR) {
    if (kbnXsrfToken) {
      jqXHR.setRequestHeader('kbn-version', internals.version);
    }
  });

  chrome.$setupXsrfRequestInterceptor = function ($httpProvider) {
    $httpProvider.interceptors.push(function () {
      return {
        request: function (opts) {
          /*
           if(opts.url.indexOf("www.cotalker.com") > -1) {
              return opts;
           }*/

          if(opts.url.indexOf("cotalker.miperroql.com") > -1) {
            return opts;
          }
          const { kbnXsrfToken = true } = opts;
          if (kbnXsrfToken) {
            set(opts, ['headers', 'kbn-version'], internals.version);
          }
          return opts;
        }
      };
    });
  };
}
