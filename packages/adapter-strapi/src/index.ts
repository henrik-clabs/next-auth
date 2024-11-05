/**
 * <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16}}>
 *  <p>An official <a href="https://www.postgresql.org/">PostgreSQL</a> adapter for Auth.js / NextAuth.js.</p>
 *  <a href="https://www.postgresql.org/">
 *   <img style={{display: "block"}} src="/img/adapters/pg.svg" width="48" />
 *  </a>
 * </div>
 *
 * ## Installation
 *
 * ```bash npm2yarn
 * npm install next-auth @auth/strapi-adapter
 * ```
 *
 *  TODO: check max length of tokens, imageurl: short vs long text
 *
 * @module @auth/strapi-adapter
 */

import type {
  Adapter,
  AdapterUser,
  VerificationToken,
  AdapterSession,
  AdapterAccount,
} from "@auth/core/adapters"

import { AxiosError, AxiosRequestConfig } from "axios"

import Strapi, { StrapiResponse } from "strapi-sdk-ts"

export function mapExpiresAt(account: any): any {
  const expires_at: number = parseInt(account.expires_at)
  return {
    ...account,
    expires_at,
  }
}

export async function db_create(
  client: Strapi,
  type: string,
  body: any
): Promise<StrapiResponse<any> | null> {
  try {
    const result = await client.create(type, body)
    console.log(
      `create ${type} body `,
      body,
      ` result ${result.status},`,
      result.data
    )
    return result
  } catch (error) {
    if (error instanceof AxiosError) {
      console.log(
        `create ${type} error AxiosError error status ${error.response?.status} ${error.response?.statusText} config.data ${error.response?.config.data}, data.error ${error.response?.data.error}`
      )
    } else console.error(error)

    /*
          console.log(
            "Error StrapiAdapter createUser ",
            error.message,
            error.status,
            error.name,
            error.code,
            error.response?.statusText,
            error.request.path,
            Object.keys(error)

*/

    return Promise.resolve(null)
  }
}

export default function StrapiAdapter(client: Strapi): Adapter {
  return {
    async createVerificationToken(
      verificationToken: VerificationToken
    ): Promise<VerificationToken> {
      const { identifier, expires, token } = verificationToken
      const data = { identifier, expires, token }
      return db_create(client, "auth-verification-tokens", { data })
    },
    async useVerificationToken({
      identifier,
      token,
    }: {
      identifier: string
      token: string
    }): Promise<VerificationToken> {
      // const sql = `delete from verification_token
      // where identifier = $1 and token = $2
      // RETURNING identifier, expires, token `
      // const result = await client.query(sql, [identifier, token])
      // return result.rowCount !== 0 ? result.rows[0] : null

      try {
        const config = as_filter(
          and(eq("identifier", identifier), eq("token", token))
        )

        // Find the document id first
        const result = await client.findAll("auth-verification-tokens", config)
        console.log("useVerificatioToken result", result.status, result.data)
        if (result.status != 200 || result.data.data.length == 0) return null

        const result1 = await client.delete(
          "auth-verification-tokens",
          result.data.data[0].documentId
        )
        console.log(
          "useVerificatioToken delete result",
          result1.status,
          result1.deleted // broken: testing for code 200 not strapi's 204
        )
        if (result1.status != 204) return null

        const out = {
          identifier: result.data.data[0].identifier,
          expires: new Date(result.data.data[0].expires),
          token: result.data.data[0].token,
        }

        return out
      } catch (error) {
        if (error instanceof AxiosError) {
          console.log(
            "useVerificationToken error AxiosError",
            error.response?.status,
            error.response?.statusText,
            error.response?.config.data,
            error.response?.data.error
          )
        } else console.error(error)
        return null
      }
    },
    async createUser(user: Omit<AdapterUser, "id">) {
      const data = {
        authuser_id: user.id,
        name: user.name,
        email: user.email,
        email_verified: user.emailVerified,
        image: user.image,
      }
      const result = await db_create(client, "auth-users", { data })
      if (result == null) return null

      const out = {
        id: result.data.data.authuser_id,
        name: result.data.data.name,
        email: result.data.data.email,
        emailVerified: new Date(result.data.data.email_verified),
        image: result.data.data.image,
      }
      return out
    },
    async getUser(id: string) {
      // return found user or null if not found
      const config = as_filter(eq("authuser_id", id))
      return await userHelper(client, config)
    },
    async getUserByEmail(email: string) {
      // return found user or null if not found
      const config = as_filter(eq("email", email))
      return await userHelper(client, config)
    },
    async getUserByAccount({
      providerAccountId,
      provider,
    }): Promise<AdapterUser | null> {
      // const sql = `
      //     select u.* from users u join accounts a on u.id = a."userId"
      //     where
      //     a.provider = $1
      //     and
      //     a."providerAccountId" = $2`

      // const result = await client.query(sql, [provider, providerAccountId])
      // return result.rowCount !== 0 ? result.rows[0] : null

      const account_config = as_filter(
        and(
          eq("provider", provider),
          eq("provider_accountid", providerAccountId)
        )
      )

      const accounts = await client.findAll("auth-accounts", account_config)
      console.log(
        "getUserByAccount account result",
        accounts.status,
        accounts.data
      )
      if (accounts.status != 200 || accounts.data.data.length == 0) return null

      const user_config = as_filter(
        eq("authuser_id", accounts.data.data[0].userid)
      )

      return await userHelper(client, user_config)
    },
    async updateUser(user: Partial<AdapterUser>): Promise<AdapterUser> {
      // const fetchSql = `select * from users where id = $1`
      // const query1 = await client.query(fetchSql, [user.id])
      // const oldUser = query1.rows[0]
      try {
        console.log("updateUser input user", user)
        const user_config = as_filter(eq("authuser_id", user.id))

        const oldUser = await client.findAll("auth-users", user_config)
        console.log("updateUser input oldUser", oldUser.status, oldUser.data)

        const newUser = {
          ...oldUser.data.data[0],
          ...user,
        }
        console.log("updateUser input newUser", newUser)

        const { id, name, email, emailVerified, image } = newUser
        // const updateSql = `
        //   UPDATE users set
        //   name = $2, email = $3, "emailVerified" = $4, image = $5
        //   where id = $1
        //   RETURNING name, id, email, "emailVerified", image
        // `
        // const query2 = await client.query(updateSql, [
        //   id,
        //   name,
        //   email,
        //   emailVerified,
        //   image,
        // ])
        // return query2.rows[0]

        const data = {
          authuser_id: id,
          name: name,
          email: email,
          email_verified: emailVerified,
          image: image,
        }

        console.log("updateUser data", oldUser.data.data[0].documentId, data)
        const result = await client.update(
          "auth-users",
          oldUser.data.data[0].documentId,
          { data }
        )
        console.log(
          "updateUser results data",
          result.status,
          result.data,
          result.data.data.name
        )

        const out = {
          id: result.data.data.authuser_id,
          name: result.data.data.name,
          email: result.data.data.email,
          emailVerified: new Date(result.data.data.email_verified),
          image: result.data.data.image,
        }
        console.log("updateUser returning out", out)

        return out
      } catch (error) {
        if (error instanceof AxiosError) {
          console.log(
            "updateUser error AxiosError",
            error.response?.status,
            error.response?.statusText,
            error.response?.config.data,
            error.response?.data.error
          )
        } else console.log("updateUser error", error)
        return null
      }
    },
    async linkAccount(account: any) {
      // const sql = `
      // insert into accounts
      // (
      //   "userId",
      //   provider,
      //   type,
      //   "providerAccountId",
      //   access_token,
      //   expires_at,
      //   refresh_token,
      //   id_token,
      //   scope,
      //   session_state,
      //   token_type
      // )
      // values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      // returning
      //   id,
      //   "userId",
      //   provider,
      //   type,
      //   "providerAccountId",
      //   access_token,
      //   expires_at,
      //   refresh_token,
      //   id_token,
      //   scope,
      //   session_state,
      //   token_type
      // `

      // const params = [
      //   account.userId,
      //   account.provider,
      //   account.type,
      //   account.providerAccountId,
      //   account.access_token,
      //   account.expires_at,
      //   account.refresh_token,
      //   account.id_token,
      //   account.scope,
      //   account.session_state,
      //   account.token_type,
      // ]

      // const result = await client.query(sql, params)
      // return mapExpiresAt(result.rows[0])

      const data = {
        userid: account.userId,
        provider: account.provider,
        type: account.type,
        provider_accountid: account.providerAccountId,
        access_token: account.access_token,
        expires_at: parseInt(account.expires_at),
        refresh_token: account.refresh_token,
        id_token: account.id_token,
        scope: account.scope,
        session_state: account.session_state,
        token_type: account.token_type,
      }

      const result = await db_create(client, "auth-accounts", { data })
      if (result == null) return null

      const out = {
        id: result.data.data.documentId,
        userId: result.data.data.userid,
        provider: result.data.data.provider,
        type: result.data.data.type,
        providerAccountId: result.data.data.provider_accountid,
        access_token: result.data.data.access_token,
        expires_at: result.data.data.expires_at, // integer
        refresh_token: result.data.data.refresh_token,
        id_token: result.data.data.id_token,
        scope: result.data.data.scope,
        session_state: result.data.data.session_state,
        token_type: result.data.data.token_type,
      }

      return out
    },
    async createSession({ sessionToken, userId, expires }) {
      if (userId === undefined) {
        throw Error(`userId is undef in createSession`)
      }
      //const sql = `insert into sessions ("userId", expires, "sessionToken")
      //values ($1, $2, $3)
      //RETURNING id, "sessionToken", "userId", expires`
      //      const result = await client.query(sql, [userId, expires, sessionToken])
      //      return result.rows[0]

      const data = {
        //        TODO: authsession_id: session.id,
        session_token: sessionToken,
        expires: expires,
        userid: userId,
      }
      const result = await db_create(client, "auth-sessions", { data })
      if (result == null) return null

      const out = {
        id: result.data.data.documentId, //TODO: Check if this is document id ?
        sessionToken: result.data.data.session_token,
        expires: new Date(result.data.data.expires),
        userId: result.data.data.userid,
      }
      return out
    },
    async getSessionAndUser(sessionToken: string | undefined): Promise<{
      session: AdapterSession
      user: AdapterUser
    } | null> {
      if (sessionToken === undefined) {
        return null
      }
      // const result1 = await client.query(
      //   `select * from sessions where "sessionToken" = $1`,
      //   [sessionToken]
      // )
      // if (result1.rowCount === 0) {
      //   return null
      // }
      // const session: AdapterSession = result1.rows[0]

      // const result2 = await client.query("select * from users where id = $1", [
      //   session.userId,
      // ])
      // if (result2.rowCount === 0) {
      //   return null
      // }
      // const user = result2.rows[0]

      const sessionfilter = as_filter(eq("session_token", sessionToken))

      const result1 = await client.findAll("auth-sessions", sessionfilter)
      console.log(
        "getSessionAndUser sessions resutl1",
        result1.status,
        result1.data
      )
      // check if session is found...
      if (result1.status !== 200 || result1.data.data.length == 0) return null

      const session = {
        id: result1.data.data[0].documentId, //TODO: Check if this is document id ?
        sessionToken: result1.data.data[0].session_token,
        expires: new Date(result1.data.data[0].expires),
        userId: result1.data.data[0].userid,
      }

      const userfilter = as_filter(eq("authuser_id", session.userId))

      const user = await userHelper(client, userfilter)
      if (user == null) return null

      return {
        session,
        user,
      }
    },
    async updateSession(
      session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">
    ): Promise<AdapterSession | null | undefined> {
      const { sessionToken } = session
      // const result1 = await client.query(
      //   `select * from sessions where "sessionToken" = $1`,
      //   [sessionToken]
      // )
      const config = as_filter(eq("session_token", sessionToken))

      try {
        const result1 = await client.findAll("auth-sessions", config)

        if (result1.data.data.length == 0) {
          return null
        }
        const originalSession: AdapterSession = result1.data.data[0]

        const newSession: AdapterSession = {
          ...originalSession,
          ...session,
        }
        // const sql = `
        //   UPDATE sessions set
        //   expires = $2
        //   where "sessionToken" = $1
        //   `
        // const result = await client.query(sql, [
        //   newSession.sessionToken,
        //   newSession.expires,
        // ])
        // return result.rows[0]

        const data = {
          //id: result1.data.data[0].documentId, //TODO: Check if this is document id ?
          session_token: result1.data.data[0].session_token,
          expires: newSession.expires,
          userid: newSession.userid,
        }
        const result = await client.update(
          "auth-sessions",
          result1.data.data[0].documentId,
          { data }
        )
        const out = {
          id: result.data.data.documentId, //TODO: Check if this is document id ?
          sessionToken: result.data.data.session_token,
          expires: new Date(result.data.data.expires),
          userId: result.data.data.userid,
        }
        return out
      } catch (error) {
        if (error instanceof AxiosError) {
          console.log(
            "updateSession error AxiosError",
            error.response?.status,
            error.response?.statusText,
            error.response?.config.data,
            error.response?.data.error
          )
        } else console.error(error)
        return null
      }
    },
    async deleteSession(sessionToken: string) {
      const sql = `delete from sessions where "sessionToken" = $1`
      // Get document id for session token

      const config = as_filter(eq("session_token", sessionToken))
      const result = await client.findAll("auth-sessions", config)

      await client.delete("auth-sessions", result.data.data[0].documentId)
    },
    async unlinkAccount(partialAccount) {
      const { provider, providerAccountId } = partialAccount
      // const sql = `delete from accounts where "providerAccountId" = $1 and provider = $2`
      // await client.query(sql, [providerAccountId, provider])

      const config = as_filter(
        and(
          eq("provider", provider),
          eq("provider_accountid", providerAccountId)
        )
      )

      const result1 = await client.findAll("auth-accounts", config)
      const result = await client.delete(
        "auth-accounts",
        result1.data.data[0].documentId
      )
    },
    async getAccount(
      providerAccountId: string,
      provider: string
    ): Promise<null | AdapterAccount> {
      const config = as_filter(
        and(
          eq("provider", provider),
          eq("provider_accountid", providerAccountId)
        )
      )

      const result = await client.findAll("auth-accounts", config)

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
    async deleteUser(userId: string) {
      // Delete need to get the strapi document id
      const authuser_config = as_filter(eq("authuser_id", userId))
      const userid_config = as_filter(eq("userid", userId))

      console.log(
        "deleteUser userId input",
        userId,
        authuser_config,
        userid_config
      )

      const user = await client.findAll("auth-users", authuser_config)
      const session = await client.findAll("auth-sessions", userid_config)
      const account = await client.findAll("auth-accounts", userid_config)

      console.log(
        "deleteUser findAll results",
        user.status,
        user.data,
        session.status,
        session.data,
        account.status,
        account.data
      )

      await client.delete("auth-users", user.data.data[0].documentId)

      // TODO: there could be more rows to delete, since this is delete by userId !!
      await client.delete("auth-sessions", session.data.data[0].documentId)
      await client.delete("auth-accounts", account.data.data[0].documentId)

      //     await client.query(`delete from users where id = $1`, [userId])
      //      await client.query(`delete from sessions where "userId" = $1`, [userId])
      //      await client.query(`delete from accounts where "userId" = $1`, [userId])
    },
  }
}

async function userHelper(client: Strapi, config: AxiosRequestConfig) {
  try {
    const result = await client.findAll("auth-users", config)
    console.log("userHelper", result.status, result.data, config)
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
  } catch (error) {
    if (error instanceof AxiosError) {
      console.log(
        "userHelper error AxiosError",
        error.response?.status,
        error.response?.statusText,
        error.response?.config.data,
        error.response?.data.error
      )
    } else console.error(error)
    return null
  }
}

/* Authenticator table from adapter-drizzle

 const authenticatorsTable =
    schema.authenticatorsTable ??
    (mysqlTable(
      "authenticator",
      {
        credentialID: varchar("credentialID", { length: 255 })
          .notNull()
          .unique(),
        userId: varchar("userId", { length: 255 })
          .notNull()
          .references(() => usersTable.id, { onDelete: "cascade" }),
        providerAccountId: varchar("providerAccountId", {
          length: 255,
        }).notNull(),
        credentialPublicKey: varchar("credentialPublicKey", {
          length: 255,
        }).notNull(),
        counter: int("counter").notNull(),
        credentialDeviceType: varchar("credentialDeviceType", {
          length: 255,
        }).notNull(),
        credentialBackedUp: boolean("credentialBackedUp").notNull(),
        transports: varchar("transports", { length: 255 }),
      },
      (authenticator) => ({
        compositePk: primaryKey({
          columns: [authenticator.userId, authenticator.credentialID],
        }),
      })
    ) satisfies DefaultMySqlAuthenticatorTable)
*/

/**
 * Equal predicate for Strapi Filters.
 * @param parms : column, value
 * @returns { column: { $eq: value }}
 */
export function eq(...parms: any): any {
  const out = {}
  const name = parms[0]
  const value = parms[1]

  // @ts-expect-error Parameter 'name' implicitly has an 'any' type.ts(7006)
  out[name] = { $eq: value }

  // create{ <name>: { $eq: <value> }}
  //console.log("$$$$ eq ", parms, name, value, out)
  return out
}
/**
 * And predicate function for Strapi Filter
 * @param parms : elements to by joined by AND
 * @returns {$and:[p1, p2 ...]}
 */
export function and(...parms: any): any {
  const out = { $and: Array.from(arguments) }
  //console.log("$$$$ and ", parms, out)

  return out
}

/**
 * Create filter parameter for Strapi Requests
 * Can be used with predicates for And and Eq
 *
 * const user = await client.findAll("auth-users", as_filter(eq("email","a.b@email.com")))
 * const user = await client.findAll("auth-users", as_filter(and(eq("email","a.b@email.com"),eq("name","Amorikie"))))
 *
 * @param a
 * @returns {params: {filters: {...}}}
 */
export function as_filter(a: any): AxiosRequestConfig {
  return { params: { filters: a } }
}
