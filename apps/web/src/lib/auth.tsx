import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ApiError, api, post } from './api'
import type { Role, User } from './types'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<User>('/auth/me')
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: 60_000,
  })
}

export const homeFor = (role: Role) => (role === 'vendor_dev' ? '/app/vendor' : '/app/provider')

export function useAuthActions() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return {
    async demoLogin(role: Role, to?: string) {
      const u = await post<User>('/auth/demo-login', { role })
      qc.clear()
      qc.setQueryData(['me'], u)
      navigate(to ?? homeFor(u.role))
    },
    async login(email: string, password: string, to?: string) {
      const u = await post<User>('/auth/login', { email, password })
      qc.clear()
      qc.setQueryData(['me'], u)
      navigate(to ?? homeFor(u.role))
    },
    async logout() {
      await post('/auth/logout').catch(() => {})
      qc.clear()
      qc.setQueryData(['me'], null)
      navigate('/signin')
    },
  }
}

export const roleLabel: Record<Role, string> = {
  provider_admin: 'Provider administrator',
  vendor_dev: 'Vendor developer',
  demo_admin: 'Demo administrator',
}
