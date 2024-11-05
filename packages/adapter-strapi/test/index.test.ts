import { runBasicTests } from "utils/adapter"
import StrapiAdapter, { and, as_filter, eq } from "../src"

import Strapi, { StrapiClientArgs } from "strapi-sdk-ts"

var propertiesReader = require("properties-reader")
var properties = propertiesReader(".env.local")

const options: StrapiClientArgs = {
  baseUrl: properties.get("STRAPI_URL"),
  apiKey: properties.get("STRAPI_API_KEY"),
}

const client = new Strapi(options)

runBasicTests({
  adapter: StrapiAdapter(client),
  testWebAuthnMethods: true,
  skipTests: [
    "getAuthenticator",
    "createAuthenticator",
    "listAuthenticatorsByUserId",
    "updateAuthenticatorCounter",
  ],
  db: {
    disconnect: async () => {
      //await client.end()
    },
    user: async (id: string) => {
      // return found user or null if not found
      const user_config = as_filter(eq("authuser_id", id))

      console.log("runBasicTests user ", id, user_config)
      const result = await client.findAll("auth-users", user_config)
      console.log("runBasicTests user result ", result.data.data)
      // Check if success code or result has data
      if (result.status != 200 || result.data.data.length == 0) return null

      const out = {
        id: result.data.data[0].authuser_id,
        name: result.data.data[0].name,
        email: result.data.data[0].email,
        emailVerified: new Date(result.data.data[0].email_verified),
        image: result.data.data[0].image,
      }
      return out
    },
    account: async (account) => {
      // const sql = `
      //     select * from accounts where "providerAccountId" = $1`
      // const result = await client.query(sql, [account.providerAccountId])
      // return result.rowCount !== 0 ? mapExpiresAt(result.rows[0]) : null
      const config = as_filter(
        eq("provider_accountid", account.providerAccountId)
      )
      const result = await client.findAll("auth-accounts", config)
      console.log(
        "index.test.ts account findAll results",
        account.providerAccountId,
        result.status,
        result.data
      )
      if (result.status != 200 || result.data.data.length == 0) return null

      const out = {
        id: result.data.data[0].documentId,
        userId: result.data.data[0].userid,
        provider: result.data.data[0].provider,
        type: result.data.data[0].type,
        providerAccountId: result.data.data[0].provider_accountid,
        access_token: result.data.data[0].access_token,
        expires_at: result.data.data[0].expires_at, // integer
        refresh_token: result.data.data[0].refresh_token,
        id_token: result.data.data[0].id_token,
        scope: result.data.data[0].scope,
        session_state: result.data.data[0].session_state,
        token_type: result.data.data[0].token_type,
      }
      return out
    },
    session: async (sessionToken) => {
      // const result1 = await client.query(
      //   `select * from sessions where "sessionToken" = $1`,
      //   [sessionToken]
      // )
      // return result1.rowCount !== 0 ? result1.rows[0] : null
      const config = as_filter(eq("session_token", sessionToken))

      console.log("runBasicTests session ", sessionToken)
      const result = await client.findAll("auth-sessions", config)
      console.log(
        "runBasicTests session result ",
        result.status,
        result.data,
        result.data.error
      )

      if (result.status != 200 || result.data.data.length == 0) return null

      const out = {
        id: result.data.data[0].documentId,
        sessionToken: result.data.data[0].session_token,
        expires: new Date(result.data.data[0].expires),
        userId: result.data.data[0].userid,
      }
      return out
    },
    async verificationToken(identifier_token) {
      const { identifier, token } = identifier_token
      // const sql = `
      //     select * from verification_token where identifier = $1 and token = $2`

      // const result = await client.query(sql, [identifier, token])
      // return result.rowCount !== 0 ? result.rows[0] : null

      const config = as_filter(
        and(eq("identifier", identifier), eq("token", token))
      )

      console.log("runtest verificationToken input", identifier, token)
      const result = await client.findAll("auth-verification-tokens", config)
      console.log(
        "runtest verificationToken result",
        result.status,
        result.data
      )
      if (result.data.data.length == 0) return null

      const out = {
        identifier: result.data.data[0].identifier,
        expires: new Date(result.data.data[0].expires),
        token: result.data.data[0].token,
      }
      return out
    },
  },
})
