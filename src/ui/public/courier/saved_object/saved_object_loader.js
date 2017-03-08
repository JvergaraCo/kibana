import _ from 'lodash';
import Scanner from 'ui/utils/scanner';
import { StringUtils } from 'ui/utils/string_utils';

let self;
const cookies = require('js-cookie');

export class SavedObjectLoader {
  constructor(SavedObjectClass, kbnIndex, esAdmin, kbnUrl, $http) {
    this.type = SavedObjectClass.type;
    this.Class = SavedObjectClass;
    this.lowercaseType = this.type.toLowerCase();
    this.kbnIndex = kbnIndex;
    this.kbnUrl = kbnUrl;
    this.esAdmin = esAdmin;
    this.$http = $http;
    self = this;
    this.scanner = new Scanner(esAdmin, {
      index: kbnIndex,
      type: this.lowercaseType
    });

    this.loaderProperties = {
      name: `${ this.lowercaseType }s`,
      noun: StringUtils.upperFirst(this.type),
      nouns: `${ this.lowercaseType }s`,
    };
  }

  /**
   * Retrieve a saved object by id. Returns a promise that completes when the object finishes
   * initializing.
   * @param id
   * @returns {Promise<SavedObject>}
   */
  get(id) {
    return (new this.Class(id)).init();
  }

  urlFor(id) {
    return this.kbnUrl.eval(`#/${ this.lowercaseType }/{{id}}`, { id: id });
  }

  delete(ids) {
    ids = !_.isArray(ids) ? [ids] : ids;

    const deletions = ids.map(id => {
      const savedObject = new this.Class(id);
      return savedObject.delete();
    });
    return Promise.all(deletions);
  }

  /**
   * Updates hit._source to contain an id and url field, and returns the updated
   * source object.
   * @param hit
   * @returns {hit._source} The modified hit._source object, with an id and url field.
   */
  mapHits(hit) {
    //opciones
    //'#/visualize/edit/{{id}}'
    //'#/discover/{{id}}'
    //'#/{{id}}'
    //'#/dashboard/{{id}}'
    const source = hit._source;
    source.id = hit._id;
    const urlOld = this.urlFor(hit._id);
    if(hit._type.localeCompare('search') === 0) {
      source.url = urlOld.replace('dashboard','discover');
    }
    else if(hit._type.localeCompare('visualization') === 0) {
      source.url = urlOld.replace('dashboard','visualize/edit');
    }
    return source;
  }

  scanAll(queryString, pageSize = 1000) {
    return this.scanner.scanAndMap(queryString, {
      pageSize,
      docCount: Infinity
    }, (hit) => this.mapHits(hit));
  }

  /**
   * TODO: Rather than use a hardcoded limit, implement pagination. See
   * https://github.com/elastic/kibana/issues/8044 for reference.
   *
   * @param searchString
   * @param size
   * @returns {Promise}
   */
  find(searchString, size = 100) {
    let body;
    if (searchString) {
      body = {
        query: {
          simple_query_string: {
            query: searchString + '*',
            fields: ['title^3', 'description'],
            default_operator: 'AND'
          }
        }
      };
    } else {
      body = { query: { match_all: {} } };
    }

    return this.esAdmin.search({
      index: this.kbnIndex,
      type: this.lowercaseType,
      body,
      size
    })
      .then((resp) => {
        const token = cookies.get('my_cookie_dot');
        return this.$http({
          method: 'GET',
          url: 'http://cotalker.miperroql.com/api/users/me',
          //url: 'https://www.cotalker.com/api/users/me',
          headers: {
            'Authorization': 'Bearer ' + token
          }
        }).then(function successCallback(response) {
          const companyid = response.data.company;
          const newList = [];
          if (companyid.localeCompare('*') !== 0) {
            resp.hits.hits.forEach((objSave) => {
              /* eslint-disable */
              const str = JSON.stringify(eval('(' + objSave._source.kibanaSavedObjectMeta.searchSourceJSON + ')'));
              /* eslint-enable */
              const nameIndex = JSON.parse(str).index;
              if (typeof nameIndex !== 'undefined' && nameIndex.indexOf(companyid) !== -1) newList.push(objSave);
            });
            resp.hits.hits = newList;
            resp.hits.total = newList.length;
            const hita = resp.hits.hits.map((hit) => self.mapHits(hit));
            return { total: resp.hits.total, hits: hita };

          }
          else {
            const hita = resp.hits.hits.map((hit) => self.mapHits(hit));
            return { total: resp.hits.total, hits: hita };
          }
        }, function errorCallback(response) {
          return {};
        });
      });
  }
}
