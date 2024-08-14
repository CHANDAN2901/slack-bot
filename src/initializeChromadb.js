const { ChromaClient } = require('chromadb');
const fs = require('fs');
const pdf = require('pdf-parse');

// Function to read and extract text from PDF
async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
}

// Function to split text into chunks
function splitTextIntoChunks(text, chunkSize) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

// Function to add documents to a ChromaDB collection
async function addDocumentsToChromaDB() {
  try {
    const client = new ChromaClient();
    const pdfText = await extractTextFromPDF('qnadoc.pdf'); // Path to your PDF

    // Split the text into chunks
    const chunks = splitTextIntoChunks(pdfText, 300); // Adjust chunk size as needed

    const collection = await client.getOrCreateCollection({
      name: "my_collection",
    });

    // Add each chunk as a separate document
    const ids = chunks.map((_, index) => `chunk-${index + 1}`);
    await collection.upsert({
      documents: chunks,
      ids: ids,
    });

    console.log("Documents added successfully!");
  } catch (error) {
    console.error("Error adding documents:", error);
  }
}

addDocumentsToChromaDB();