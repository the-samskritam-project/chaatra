// MongoDB shell script to create vector search index
// 
// Usage options:
//   1. mongosh mongodb://localhost:27017 < create_vector_index.mongosh.js
//   2. mongosh mongodb://localhost:27017 --file create_vector_index.mongosh.js
//   3. docker exec -i hitopadesa_mongodb mongosh < create_vector_index.mongosh.js
//   4. docker exec -it hitopadesa_mongodb mongosh
//      Then copy-paste the commands below

use hitopadesa;

print("=".repeat(60));
print("Creating Vector Search Index");
print("=".repeat(60));
print("Database: hitopadesa");
print("Collection: corpus_vector_search");
print("Index name: corpus_translation_vector_index");
print("");

// Check if collection exists
var collectionExists = db.getCollectionNames().includes('corpus_vector_search');
if (!collectionExists) {
    print('❌ ERROR: Collection corpus_vector_search does not exist!');
    print('Please generate embeddings first.');
    quit(1);
}

// Check document count
var count = db.corpus_vector_search.countDocuments({});
print('✓ Collection exists with ' + count + ' documents');

// Check if vector search is supported
print('\nChecking if vector search is supported...');
var hasListSearchIndexes = typeof db.corpus_vector_search.listSearchIndexes === 'function';
var hasCreateSearchIndex = typeof db.corpus_vector_search.createSearchIndex === 'function';

if (!hasListSearchIndexes || !hasCreateSearchIndex) {
    print('❌ Vector search indexes are NOT available in this MongoDB setup.');
    print('\n' + '='.repeat(60));
    print('VECTOR SEARCH INDEXES NOT SUPPORTED');
    print('='.repeat(60));
    print('Your MongoDB version: ' + db.version());
    print('This appears to be MongoDB Community Edition without vector search support.');
    print('\nVector search indexes are typically available in:');
    print('  - MongoDB Atlas (cloud)');
    print('  - MongoDB Enterprise Server');
    print('  - Special builds with vector search enabled');
    print('\n' + '='.repeat(60));
    print('GOOD NEWS: SEMANTIC SEARCH STILL WORKS!');
    print('='.repeat(60));
    print('You can use semantic search RIGHT NOW without the index.');
    print('It uses a fallback cosine similarity method (slower but functional).');
    print('\nTest it now:');
    print('  cd corpus');
    print('  python command_processor.py vector_search --query "wisdom and knowledge"');
    print('\nFor production with fast vector search, consider:');
    print('  - Using MongoDB Atlas');
    print('  - Or continue using the fallback method (works fine for smaller datasets)');
    print('='.repeat(60));
    quit(0);
}

print('✓ Vector search methods are available');

// Check for existing indexes
print('\nChecking for existing search indexes...');
var existingIndexes = [];
try {
    var cursor = db.corpus_vector_search.listSearchIndexes();
    existingIndexes = cursor.toArray();
    
    if (existingIndexes.length > 0) {
        print('Found ' + existingIndexes.length + ' existing search index(es):');
        existingIndexes.forEach(function(idx) {
            print('  - ' + idx.name + ' (status: ' + (idx.status || 'unknown') + ')');
        });
        
        // Check if our index already exists
        var indexExists = existingIndexes.some(function(idx) {
            return idx.name === 'corpus_translation_vector_index';
        });
        
        if (indexExists) {
            print('\n✓ Index "corpus_translation_vector_index" already exists!');
            print('No need to create it again.');
            quit(0);
        }
    } else {
        print('No existing search indexes found.');
    }
} catch (e) {
    print('⚠ Could not list existing indexes: ' + e);
}

// Create the vector search index
print('\nCreating vector search index...');
print('This may take a few minutes for large collections...\n');

try {
    // createSearchIndex(name, type, definition)
    var result = db.corpus_vector_search.createSearchIndex(
        "corpus_translation_vector_index",  // index name
        "vectorSearch",                      // index type
        {
            fields: [
                {
                    type: "vector",
                    path: "embedding",
                    numDimensions: 1536,
                    similarity: "cosine"
                }
            ]
        }
    );
    
    print('✓ Index creation initiated!');
    print('Index ID: ' + JSON.stringify(result));
    print('\nThe index is now building. This may take a few minutes.');
    print('\nTo check status, run:');
    print('  db.corpus_vector_search.listSearchIndexes()');
    print('\nOnce the status shows "READY", you can use fast vector search!');
    print('\nYou can test semantic search now (will use fallback if index not ready):');
    print('  python command_processor.py vector_search --query "your query"');
    
} catch (e) {
    var errorMsg = e.toString();
    print('❌ ERROR creating index: ' + errorMsg);
    
    if (errorMsg.includes('no such command') || errorMsg.includes('not a function')) {
        print('\n' + '='.repeat(60));
        print('VECTOR SEARCH INDEXES NOT AVAILABLE');
        print('='.repeat(60));
        print('This MongoDB setup does not support vector search indexes.');
        print('This is normal for MongoDB Community Edition.');
        print('\n✅ SEMANTIC SEARCH STILL WORKS WITHOUT THE INDEX!');
        print('The fallback cosine similarity method will be used automatically.');
        print('\nTest semantic search now:');
        print('  cd corpus');
        print('  python command_processor.py vector_search --query "your query"');
        print('\nFor fast vector search in production, use MongoDB Atlas.');
        print('='.repeat(60));
    } else {
        print('\nPossible reasons:');
        print('1. MongoDB version < 7.0.11 (vector search not supported)');
        print('2. Vector search not enabled in your MongoDB setup');
        print('3. Collection is empty or has no embeddings');
        print('\nYour MongoDB version: ' + db.version());
    }
    quit(1);
}
