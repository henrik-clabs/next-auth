'use strict';

/**
 * auth-verification-token service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::auth-verification-token.auth-verification-token');
