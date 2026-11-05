import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Obtiene el catálogo completo de productos sin la limitación predeterminada 
 * de 1,000 filas de PostgREST / Supabase.
 * Realiza la paginación interna por lotes para garantizar que todos los productos 
 * (actualmente 1,915+) se carguen en memoria.
 */
export async function fetchAllProducts(
  supabase: any,
  selectQuery: string = '*, categories(name)',
  orderBy: string = 'name',
  ascending: boolean = true
): Promise<any[]> {
  let allProducts: any[] = []
  let from = 0
  const step = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('products')
      .select(selectQuery)
      .order(orderBy, { ascending })
      .range(from, from + step - 1)

    if (error) {
      console.error('Error fetching products chunk:', error)
      break
    }

    if (data && data.length > 0) {
      allProducts = allProducts.concat(data)
      if (data.length < step) {
        hasMore = false
      } else {
        from += step
      }
    } else {
      hasMore = false
    }
  }

  return allProducts
}
