const { connectDB } = require('../../services/db.js');
const distributedCache = require('../../services/cache/cacheService.js');

// Stats pour monitoring
let processorStats = {
  totalProcessed: 0,
  totalErrors: 0,
  averageProcessingTime: 0
};

const handler = async (event, context) => {
  // Pattern Lambda officiel
  context.callbackWaitsForEmptyEventLoop = false;
  
  const processingStart = Date.now();
  
  try {
    console.log('🚀 Async Processor: Démarrage traitement batch');
    
    // Connexion à la base de données
    await connectDB();
    
    // Traiter chaque message du batch SQS
    const results = [];
    
    for (const record of event.Records) {
      const messageStart = Date.now();
      
      try {
        const messageBody = JSON.parse(record.body);
        console.log(`📨 Traitement message: ${messageBody.type || 'unknown'}`);
        
        // Router vers le bon processeur selon le type
        const result = await processMessage(messageBody);
        
        const messageDuration = Date.now() - messageStart;
        console.log(`✅ Message traité en ${messageDuration}ms`);
        
        results.push({
          messageId: record.messageId,
          status: 'success',
          result: result,
          duration: messageDuration
        });
        
        processorStats.totalProcessed++;
        
      } catch (messageError) {
        const messageDuration = Date.now() - messageStart;
        console.error(`❌ Erreur traitement message:`, messageError);
        
        results.push({
          messageId: record.messageId,
          status: 'error',
          error: messageError.message,
          duration: messageDuration
        });
        
        processorStats.totalErrors++;
      }
    }
    
    const totalDuration = Date.now() - processingStart;
    processorStats.averageProcessingTime = 
      (processorStats.averageProcessingTime + totalDuration) / 2;
    
    console.log(`🎯 Batch traité: ${results.length} messages en ${totalDuration}ms`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        processed: results.length,
        duration: totalDuration,
        results: results,
        stats: processorStats
      })
    };
    
  } catch (error) {
    const totalDuration = Date.now() - processingStart;
    console.error('💥 Erreur Async Processor:', error);
    
    processorStats.totalErrors++;
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        duration: totalDuration,
        stats: processorStats
      })
    };
  }
};

// Router pour différents types de messages
async function processMessage(messageBody) {
  const { type, data, jobId } = messageBody;
  
  switch (type) {
    case 'email_notification':
      return await processEmailNotification(data, jobId);
      
    case 'image_processing':
      return await processImageProcessing(data, jobId);
      
    case 'report_generation':
      return await processReportGeneration(data, jobId);
      
    case 'data_cleanup':
      return await processDataCleanup(data, jobId);
      
    case 'cache_warmup':
      return await processCacheWarmup(data, jobId);
      
    default:
      throw new Error(`Type de message non supporté: ${type}`);
  }
}

// Processeurs spécialisés
async function processEmailNotification(data, jobId) {
  console.log(`📧 Traitement notification email pour job ${jobId}`);
  
  // Simuler l'envoi d'email
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Mettre en cache le résultat
  await distributedCache.set(`job:${jobId}`, {
    status: 'completed',
    type: 'email_notification',
    result: 'Email envoyé avec succès'
  }, 'session', 300);
  
  return { emailSent: true, recipient: data.email };
}

async function processImageProcessing(data, jobId) {
  console.log(`🖼️ Traitement image pour job ${jobId}`);
  
  // Simuler le traitement d'image
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const result = {
    originalUrl: data.imageUrl,
    processedUrl: data.imageUrl + '_processed',
    thumbnailUrl: data.imageUrl + '_thumb',
    metadata: {
      width: 800,
      height: 600,
      format: 'jpg'
    }
  };
  
  // Stocker le résultat
  await distributedCache.set(`job:${jobId}`, {
    status: 'completed',
    type: 'image_processing',
    result: result
  }, 'session', 600);
  
  return result;
}

async function processReportGeneration(data, jobId) {
  console.log(`📊 Génération rapport pour job ${jobId}`);
  
  // Simuler la génération de rapport
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const result = {
    reportId: jobId,
    reportUrl: `https://reports.perkup.com/${jobId}.pdf`,
    generatedAt: new Date().toISOString(),
    format: 'PDF',
    size: '2.5 MB'
  };
  
  // Stocker le résultat
  await distributedCache.set(`job:${jobId}`, {
    status: 'completed',
    type: 'report_generation',
    result: result
  }, 'session', 3600);
  
  return result;
}

async function processDataCleanup(data, jobId) {
  console.log(`🧹 Nettoyage données pour job ${jobId}`);
  
  // Simuler le nettoyage de données
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const result = {
    itemsProcessed: Math.floor(Math.random() * 1000) + 100,
    itemsDeleted: Math.floor(Math.random() * 50) + 10,
    spaceSaved: '15.2 MB'
  };
  
  // Stocker le résultat
  await distributedCache.set(`job:${jobId}`, {
    status: 'completed',
    type: 'data_cleanup',
    result: result
  }, 'session', 300);
  
  return result;
}

async function processCacheWarmup(data, jobId) {
  console.log(`🔥 Warmup cache pour job ${jobId}`);
  
  const { userId, type: warmupType } = data;
  
  if (userId && warmupType === 'user') {
    // Utiliser la fonction warmup du cache distribué
    await distributedCache.warmup(userId);
  }
  
  const result = {
    warmupCompleted: true,
    userId: userId,
    itemsPreloaded: Math.floor(Math.random() * 20) + 5
  };
  
  // Stocker le résultat
  await distributedCache.set(`job:${jobId}`, {
    status: 'completed',
    type: 'cache_warmup',
    result: result
  }, 'session', 600);
  
  return result;
}

// Export des stats pour monitoring
const getProcessorStats = () => processorStats;

// Exports CommonJS
module.exports = {
  handler,
  getProcessorStats
};
