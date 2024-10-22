'use strict';

/**
 * auth-session router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::auth-session.auth-session');
