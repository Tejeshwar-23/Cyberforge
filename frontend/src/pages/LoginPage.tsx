import {
  useState,
} from 'react'

import {
  Activity,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import {
  useNavigate,
} from 'react-router-dom'

import {
  useAuth,
} from '../auth/useAuth'

import {
  readableApiError,
} from '../lib/api'


export function LoginPage() {
  const navigate =
    useNavigate()

  const {
    login,
  } = useAuth()

  const [
    username,
    setUsername,
  ] = useState('')

  const [
    password,
    setPassword,
  ] = useState('')

  const [
    error,
    setError,
  ] = useState('')

  const [
    submitting,
    setSubmitting,
  ] = useState(false)


  async function submit(
    event: React.FormEvent,
  ) {
    event.preventDefault()

    setError('')
    setSubmitting(true)

    try {
      await login(
        username.trim(),
        password,
      )

      navigate(
        '/',
        {
          replace: true,
        },
      )
    }
    catch (requestError) {
      setError(
        readableApiError(
          requestError,
        ),
      )
    }
    finally {
      setSubmitting(false)
    }
  }


  return (
    <main
      className="
        cyber-grid
        min-h-screen
        bg-[#080b12]
        text-slate-100
      "
    >
      <div
        className="
          mx-auto
          grid
          min-h-screen
          max-w-7xl
          grid-cols-1
          lg:grid-cols-2
        "
      >
        <section
          className="
            hidden
            flex-col
            justify-between
            border-r
            border-white/5
            p-12
            lg:flex
          "
        >
          <div>
            <div
              className="
                inline-flex
                items-center
                gap-3
              "
            >
              <div
                className="
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-blue-400/20
                  bg-blue-500/10
                "
              >
                <ShieldCheck
                  className="
                    h-6
                    w-6
                    text-blue-400
                  "
                />
              </div>

              <div>
                <div
                  className="
                    text-lg
                    font-semibold
                    tracking-tight
                  "
                >
                  CyberForge
                </div>

                <div
                  className="
                    text-xs
                    text-slate-500
                  "
                >
                  Security Integration Platform
                </div>
              </div>
            </div>

            <div
              className="
                mt-28
                max-w-xl
              "
            >
              <div
                className="
                  mb-5
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-blue-400/15
                  bg-blue-400/5
                  px-3
                  py-1.5
                  text-xs
                  text-blue-300
                "
              >
                <Sparkles
                  className="h-3.5 w-3.5"
                />
                Config-driven security operations
              </div>

              <h1
                className="
                  text-5xl
                  font-semibold
                  leading-tight
                  tracking-[-0.04em]
                  text-white
                "
              >
                One engine.
                <br />
                Every integration.
              </h1>

              <p
                className="
                  mt-6
                  max-w-lg
                  text-base
                  leading-7
                  text-slate-400
                "
              >
                Connect security products through
                configuration, normalize their data,
                monitor execution health, and recover
                safely from schema drift.
              </p>
            </div>
          </div>

          <div
            className="
              grid
              grid-cols-3
              gap-3
            "
          >
            {[
              [
                'Multi-Vendor',
                'Security sources',
              ],
              [
                'Catalog',
                'Connector templates',
              ],
              [
                'Live',
                'Normalized records',
              ],
            ].map(
              ([value, label]) => (
                <div
                  key={label}
                  className="
                    rounded-xl
                    border
                    border-white/5
                    bg-white/[0.025]
                    p-4
                  "
                >
                  <div
                    className="
                      text-xl
                      font-semibold
                      text-white
                    "
                  >
                    {value}
                  </div>

                  <div
                    className="
                      mt-1
                      text-xs
                      text-slate-500
                    "
                  >
                    {label}
                  </div>
                </div>
              ),
            )}
          </div>
        </section>


        <section
          className="
            flex
            min-h-screen
            items-center
            justify-center
            px-6
            py-12
          "
        >
          <div
            className="
              w-full
              max-w-md
            "
          >
            <div
              className="
                mb-10
                lg:hidden
              "
            >
              <div
                className="
                  inline-flex
                  items-center
                  gap-3
                "
              >
                <ShieldCheck
                  className="
                    h-7
                    w-7
                    text-blue-400
                  "
                />

                <span
                  className="
                    text-xl
                    font-semibold
                  "
                >
                  CyberForge
                </span>
              </div>
            </div>


            <div
              className="
                rounded-2xl
                border
                border-white/8
                bg-[#0d111a]/90
                p-7
                shadow-2xl
                shadow-black/30
                backdrop-blur-xl
              "
            >
              <div
                className="
                  mb-7
                "
              >
                <div
                  className="
                    mb-4
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    bg-blue-500/10
                  "
                >
                  <LockKeyhole
                    className="
                      h-5
                      w-5
                      text-blue-400
                    "
                  />
                </div>

                <h2
                  className="
                    text-2xl
                    font-semibold
                    tracking-tight
                    text-white
                  "
                >
                  Sign in
                </h2>

                <p
                  className="
                    mt-2
                    text-sm
                    leading-6
                    text-slate-500
                  "
                >
                  Authenticate with your
                  CyberForge account.
                </p>
              </div>


              <form
                className="space-y-5"
                onSubmit={submit}
              >
                <label
                  className="
                    block
                  "
                >
                  <span
                    className="
                      mb-2
                      block
                      text-sm
                      font-medium
                      text-slate-300
                    "
                  >
                    Username
                  </span>

                  <input
                    required
                    autoComplete="username"
                    value={username}
                    onChange={
                      (event) =>
                        setUsername(
                          event.target.value,
                        )
                    }
                    className="
                      h-11
                      w-full
                      rounded-lg
                      border
                      border-white/10
                      bg-black/20
                      px-3.5
                      text-sm
                      text-white
                      outline-none
                      transition
                      placeholder:text-slate-600
                      focus:border-blue-500/60
                      focus:ring-2
                      focus:ring-blue-500/10
                    "
                    placeholder="Enter username"
                  />
                </label>


                <label
                  className="
                    block
                  "
                >
                  <span
                    className="
                      mb-2
                      block
                      text-sm
                      font-medium
                      text-slate-300
                    "
                  >
                    Password
                  </span>

                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={
                      (event) =>
                        setPassword(
                          event.target.value,
                        )
                    }
                    className="
                      h-11
                      w-full
                      rounded-lg
                      border
                      border-white/10
                      bg-black/20
                      px-3.5
                      text-sm
                      text-white
                      outline-none
                      transition
                      placeholder:text-slate-600
                      focus:border-blue-500/60
                      focus:ring-2
                      focus:ring-blue-500/10
                    "
                    placeholder="Enter password"
                  />
                </label>


                {error && (
                  <div
                    className="
                      rounded-lg
                      border
                      border-red-500/20
                      bg-red-500/5
                      px-3
                      py-2.5
                      text-sm
                      text-red-300
                    "
                  >
                    {error}
                  </div>
                )}


                <button
                  type="submit"
                  disabled={submitting}
                  className="
                    flex
                    h-11
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-lg
                    bg-blue-600
                    text-sm
                    font-medium
                    text-white
                    transition
                    hover:bg-blue-500
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >
                  {submitting
                    ? 'Authenticating...'
                    : 'Sign in to CyberForge'}
                </button>
              </form>
            </div>



            <div
              className="
                mt-5
                flex
                items-center
                justify-center
                gap-2
                text-xs
                text-slate-600
              "
            >
              <Activity
                className="
                  h-3.5
                  w-3.5
                "
              />

              API
              {' '}
              {import.meta.env.VITE_API_BASE_URL
                ?? 'http://127.0.0.1:8000'}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}