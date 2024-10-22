'use strict';

/**
 * auth-account service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::auth-account.auth-account');
