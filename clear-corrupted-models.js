/**
 * Clear corrupted models from OPFS
 * 
 * Run this script in the browser console to delete corrupted models.
 * After clearing, the app will re-download them fresh.
 * 
 * Usage:
 * 1. Open Chrome/Edge DevTools Console (F12)
 * 2. Copy and paste this entire script
 * 3. Press Enter
 * 4. Refresh the page
 */

(async function clearCorruptedModels() {
  try {
    console.log('🧹 Starting OPFS cleanup...');
    
    // Access OPFS root
    const opfsRoot = await navigator.storage.getDirectory();
    console.log('✅ OPFS root accessed');
    
    // List of potentially corrupted models to clear
    const modelsToDelete = [
      'smollm2-135m',           // Corrupted: "unexpectedly reached end of file"
      'smollm2-135m.gguf',
    ];
    
    // Try to delete models directory
    try {
      const modelsDir = await opfsRoot.getDirectoryHandle('models', { create: false });
      console.log('📁 Found /models directory');
      
      for (const modelName of modelsToDelete) {
        try {
          await modelsDir.removeEntry(modelName, { recursive: true });
          console.log(`✅ Deleted: ${modelName}`);
        } catch (err) {
          if (err.name !== 'NotFoundError') {
            console.log(`⚠️ Could not delete ${modelName}:`, err.message);
          }
        }
      }
    } catch (err) {
      if (err.name === 'NotFoundError') {
        console.log('ℹ️ No /models directory found (already clean)');
      } else {
        throw err;
      }
    }
    
    console.log('\n✅ Cleanup complete!');
    console.log('\n📌 Next steps:');
    console.log('1. Refresh the page (F5)');
    console.log('2. Navigate to Voice tab');
    console.log('3. Models will download fresh');
    
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    console.log('\nℹ️ Alternative: Clear all site data from DevTools:');
    console.log('1. Open DevTools (F12)');
    console.log('2. Go to Application tab');
    console.log('3. Click "Clear site data"');
    console.log('4. Refresh page');
  }
})();
