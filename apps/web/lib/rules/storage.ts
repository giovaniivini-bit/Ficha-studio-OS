import { CatalogSchema, type FabricCatalog } from './catalog';

async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ficha-studio-rules', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('catalogs', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Não foi possível abrir o cadastro local de regras.'));
  });
}
export async function listCatalogs(): Promise<FabricCatalog[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('catalogs', 'readonly');
    const req = tx.objectStore('catalogs').getAll();
    tx.oncomplete = () => { database.close(); try { resolve(req.result.map(value => CatalogSchema.parse(value)).sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))); } catch { reject(new Error('Cadastro local inválido. Exporte uma cópia antes de substituir dados.')); } };
    tx.onerror = tx.onabort = () => { database.close(); reject(new Error('Falha ao consultar as regras locais.')); };
  });
}
export async function approveCatalog(catalog: FabricCatalog) {
  const value = CatalogSchema.parse(catalog);
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction('catalogs', 'readwrite');
    tx.objectStore('catalogs').add(value);
    tx.oncomplete = () => { database.close(); resolve(); };
    tx.onerror = tx.onabort = () => { database.close(); reject(new Error('Não foi possível salvar as regras. O catálogo anterior foi preservado.')); };
  });
}
