import { Hono } from 'hono'
import * as jose from 'jose'

export const authRoutes = new Hono()

// Apple Sign-In token exchange
authRoutes.post('/apple', async (c) => {
  try {
    const { identityToken, authorizationCode, user } = await c.req.json()

    // TODO: Verify Apple identity token
    // - Fetch Apple's public keys from https://appleid.apple.com/auth/keys
    // - Verify JWT signature
    // - Check issuer, audience, expiry

    // For now, decode the token to get user info
    const decoded = jose.decodeJwt(identityToken)
    const appleUserId = decoded.sub as string
    const email = decoded.email as string

    // TODO: Upsert user in database
    // TODO: Generate our own JWT

    const accessToken = await generateAccessToken(appleUserId)
    const refreshToken = await generateRefreshToken(appleUserId)

    return c.json({
      accessToken,
      refreshToken,
      user: {
        id: appleUserId,
        email,
        givenName: user?.givenName,
        familyName: user?.familyName,
      }
    })
  } catch (error) {
    console.error('Apple auth error:', error)
    return c.json({ error: 'Authentication failed' }, 401)
  }
})

// Refresh access token
authRoutes.post('/refresh', async (c) => {
  try {
    const { refreshToken } = await c.req.json()

    // TODO: Verify refresh token and issue new access token
    const accessToken = 'new-access-token'

    return c.json({ accessToken })
  } catch (error) {
    return c.json({ error: 'Token refresh failed' }, 401)
  }
})

// Helper functions
async function generateAccessToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret')

  return await new jose.SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setIssuer('fuelup-api')
    .sign(secret)
}

async function generateRefreshToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret')

  return await new jose.SignJWT({ userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .setIssuer('fuelup-api')
    .sign(secret)
}
