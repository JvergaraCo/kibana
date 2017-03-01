import _ from 'lodash';
const cookies = require('js-cookie');

export default function GetIndexPatternIdsFn(esAdmin, kbnIndex, $http) {

  // many places may require the id list, so we will cache it seperately
  // didn't incorportate with the indexPattern cache to prevent id collisions.
  let cachedPromise;
  let cachedIds;
  const getIds = function () {
    if (cachedPromise) {
      // retrun a clone of the cached response
      return cachedPromise.then(function (cachedResp) {
        return _.clone(cachedResp);
      });
    }
    const token = cookies.get('my_cookie_dot');
    cachedPromise = esAdmin.search({
      index: kbnIndex,
      type: 'index-pattern',
      storedFields: [],
      body: {
        query: { match_all: {} },
        size: 10000
      }
    })
    .then(function (resp) {
      const indices = _.pluck(resp.hits.hits, '_id');
      return $http({
        method: 'GET',
        url: 'http://cotalker.miperroql.com/api/users/me',
        //url: 'https://www.cotalker.com/api/users/me',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      }).then(function successCallback(response) {
        //const companyid = response['data']['companies'][0].companyId;
        const companyid = response.data.company;
        const newList = [];
        if (companyid.localeCompare('*') !== 0) {
          indices.map(function (indx) {
            if (indx.indexOf(companyid) !== -1) newList.push(indx);
          });
          cachedIds = newList;
          return newList;
        }
        else return indices;
      }, function errorCallback(response) {
        return [];
      });

    });

    // ensure that the response stays pristine by cloning it here too
    return cachedPromise.then(function (resp) {
      return _.clone(resp);
    });
  };

  getIds.clearCache = function () {
    cachedPromise = null;
  };

  return getIds;
}
