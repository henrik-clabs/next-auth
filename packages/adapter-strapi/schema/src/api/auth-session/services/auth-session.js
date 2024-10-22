'use strict';

/**
 * auth-session service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::auth-session.auth-session');
