import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function fetchProducts(filters = {}) {
  let query = supabase
    .from('products')
    .select(`
      *,
      brand:brands(name),
      category:categories(name)
    `)
    .order('created_at', { ascending: false });

  if (filters.brands && filters.brands.length > 0) {
    const brandIds = await getBrandIdsByNames(filters.brands);
    query = query.in('brand_id', brandIds);
  }

  if (filters.colors && filters.colors.length > 0) {
    query = query.in('color', filters.colors);
  }

  if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
    query = query.gte('price', filters.minPrice).lte('price', filters.maxPrice);
  }

  if (filters.discountOnly) {
    query = query.gt('discount_percentage', 0);
  }

  if (filters.discountPercentage) {
    query = query.gte('discount_percentage', filters.discountPercentage);
  }

  if (filters.rating) {
    query = query.gte('rating', filters.rating);
  }

  if (filters.screenSizes && filters.screenSizes.length > 0) {
    query = query.in('screen_size', filters.screenSizes);
  }

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  return data;
}

async function getBrandIdsByNames(brandNames) {
  const { data, error } = await supabase
    .from('brands')
    .select('id')
    .in('name', brandNames);

  if (error) {
    console.error('Error fetching brand IDs:', error);
    return [];
  }

  return data.map(b => b.id);
}

export async function getBrands() {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching brands:', error);
    return [];
  }

  return data;
}

function getSessionId() {
  let sessionId = localStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('session_id', sessionId);
  }
  return sessionId;
}

export async function addToCart(productId) {
  const sessionId = getSessionId();

  const { data: existing } = await supabase
    .from('cart_items')
    .select('*')
    .eq('session_id', sessionId)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({
        quantity: existing.quantity + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (error) {
      console.error('Error updating cart:', error);
      return false;
    }
  } else {
    const { error } = await supabase
      .from('cart_items')
      .insert({
        session_id: sessionId,
        product_id: productId,
        quantity: 1
      });

    if (error) {
      console.error('Error adding to cart:', error);
      return false;
    }
  }

  return true;
}

export async function getCartItems() {
  const sessionId = getSessionId();

  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      *,
      product:products(*)
    `)
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error fetching cart:', error);
    return [];
  }

  return data;
}

export async function updateCartItemQuantity(cartItemId, quantity) {
  if (quantity <= 0) {
    return removeCartItem(cartItemId);
  }

  const { error } = await supabase
    .from('cart_items')
    .update({
      quantity,
      updated_at: new Date().toISOString()
    })
    .eq('id', cartItemId);

  if (error) {
    console.error('Error updating cart item:', error);
    return false;
  }

  return true;
}

export async function removeCartItem(cartItemId) {
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', cartItemId);

  if (error) {
    console.error('Error removing cart item:', error);
    return false;
  }

  return true;
}

export async function getCartCount() {
  const items = await getCartItems();
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
