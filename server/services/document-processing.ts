import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage';
import axios from 'axios';
import FormData from 'form-data';
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Map to store processing jobs status
const processingJobs = new Map<string, ProcessingJobStatus>();

interface ProcessingJobStatus {
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
  userId: number;
  fileName: string;
  filePath: string;
  whisperHash?: string;
  extractedText?: string;
  extractedData?: any;
}

/**
 * Ensure upload directories exist
 */
export async function ensureUploadDirectories(): Promise<void> {
  const uploadDir = path.join(process.cwd(), 'uploads');
  const tempDir = path.join(uploadDir, 'temp');
  const processedDir = path.join(uploadDir, 'processed');

  try {
    // Create directories if they don't exist
    await fsPromises.mkdir(uploadDir, { recursive: true });
    await fsPromises.mkdir(tempDir, { recursive: true });
    await fsPromises.mkdir(processedDir, { recursive: true });
    
    console.log('Upload directories created successfully');
  } catch (error) {
    console.error('Error creating upload directories:', error);
    throw error;
  }
}

/**
 * Save uploaded file to disk
 */
export async function saveUploadedFile(
  file: Express.Multer.File,
  userId: number
): Promise<string> {
  try {
    // Generate a unique document ID
    const documentId = uuidv4();
    
    // Get file extension
    const fileExt = path.extname(file.originalname);
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Create paths
    const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
    const filePath = path.join(uploadDir, `${documentId}${fileExt}`);
    
    // Write file to disk
    await fsPromises.writeFile(filePath, file.buffer);
    
    // Create document record in database
    const document = await storage.createCompanyDocument({
      id: documentId,
      userId: userId,
      fileName: sanitizedFileName,
      fileType: file.mimetype,
      filePath: filePath,
      fileSize: file.size,
      status: 'pending',
      uploadedAt: new Date()
    });
    
    // Store job status
    processingJobs.set(documentId, {
      documentId,
      status: 'pending',
      userId,
      fileName: sanitizedFileName,
      filePath
    });
    
    return documentId;
  } catch (error) {
    console.error('Error saving uploaded file:', error);
    throw new Error('Failed to save uploaded file');
  }
}

/**
 * Process document with WhisperLLM API for OCR
 */
export async function processDocumentWithOCR(documentId: string): Promise<void> {
  try {
    // Get document from database
    const document = await storage.getCompanyDocument(documentId);
    
    if (!document) {
      throw new Error('Document not found');
    }
    
    // Update processing status
    await storage.updateCompanyDocument(documentId, {
      status: 'processing',
      processingStartedAt: new Date()
    });
    
    const jobStatus = processingJobs.get(documentId);
    if (jobStatus) {
      jobStatus.status = 'processing';
    } else {
      processingJobs.set(documentId, {
        documentId,
        status: 'processing',
        userId: document.userId,
        fileName: document.fileName,
        filePath: document.filePath
      });
    }
    
    // Call WhisperLLM API for OCR
    try {
      // Create form data with the file
      const form = new FormData();
      form.append('file', fs.createReadStream(document.filePath));
      
      // Call WhisperLLM API
      const whisperResponse = await axios.post(
        'https://llmwhisperer-api.us-central.unstract.com/api/v2/whisper',
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${process.env.UNSTRACT_API_KEY}`
          },
          timeout: 180000 // 3 minutes timeout
        }
      );
      
      if (whisperResponse.status === 200 && whisperResponse.data.hash) {
        // Update job status with whisper hash
        const jobStatus = processingJobs.get(documentId);
        if (jobStatus) {
          jobStatus.whisperHash = whisperResponse.data.hash;
        }
        
        // Poll for OCR results
        await getOCRResults(documentId, whisperResponse.data.hash);
      } else {
        throw new Error(whisperResponse.data?.message || 'Failed to process document with OCR');
      }
    } catch (error: any) {
      console.error('Error calling WhisperLLM API:', error);
      
      // Update processing status to error
      await storage.updateCompanyDocument(documentId, {
        status: 'error',
        errorMessage: error.message || 'Error calling WhisperLLM API',
        processingCompletedAt: new Date()
      });
      
      const jobStatus = processingJobs.get(documentId);
      if (jobStatus) {
        jobStatus.status = 'error';
        jobStatus.message = error.message || 'Error calling WhisperLLM API';
      }
    }
  } catch (error: any) {
    console.error('Error processing document with OCR:', error);
    
    // Update processing status to error
    await storage.updateCompanyDocument(documentId, {
      status: 'error',
      errorMessage: error.message || 'Error processing document',
      processingCompletedAt: new Date()
    });
    
    const jobStatus = processingJobs.get(documentId);
    if (jobStatus) {
      jobStatus.status = 'error';
      jobStatus.message = error.message || 'Error processing document';
    }
  }
}

/**
 * Poll WhisperLLM API for OCR results
 */
async function getOCRResults(documentId: string, whisperHash: string): Promise<void> {
  try {
    // Poll WhisperLLM API for results
    const maxRetries = 20;
    let retries = 0;
    let extractedText = null;
    
    while (retries < maxRetries) {
      // Wait between retries
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
      
      try {
        // Check OCR status
        const ocrStatusResponse = await axios.get(
          `https://llmwhisperer-api.us-central.unstract.com/api/v2/whisper/${whisperHash}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.UNSTRACT_API_KEY}`
            }
          }
        );
        
        // If OCR is complete, extract text and process with GPT-4o
        if (ocrStatusResponse.status === 200 && ocrStatusResponse.data.status === 'complete') {
          extractedText = ocrStatusResponse.data.text;
          
          // Update job status
          const jobStatus = processingJobs.get(documentId);
          if (jobStatus) {
            jobStatus.extractedText = extractedText;
          }
          
          // Process extracted text with OpenAI to identify company information
          if (extractedText) {
            const document = await storage.getCompanyDocument(documentId);
            if (document) {
              const extractedData = await extractCompanyInformation(extractedText, document.userId);
              
              // Update document with extracted text and data
              await storage.updateCompanyDocument(documentId, {
                status: 'completed',
                extractedText,
                extractedData,
                processingCompletedAt: new Date()
              });
              
              // Update user profile with extracted company information
              await updateUserProfileWithExtractedData(document.userId, extractedData);
              
              // Update job status
              const jobStatus = processingJobs.get(documentId);
              if (jobStatus) {
                jobStatus.status = 'completed';
                jobStatus.extractedData = extractedData;
              }
            }
          }
          
          // Processing complete, exit loop
          break;
        } else if (ocrStatusResponse.data.status === 'error') {
          throw new Error(ocrStatusResponse.data.message || 'Error processing document with OCR');
        }
      } catch (error: any) {
        console.error('Error checking OCR status:', error);
        if (retries >= maxRetries - 1) {
          throw error;
        }
      }
      
      retries++;
    }
    
    // If no text was extracted after max retries, throw error
    if (!extractedText) {
      throw new Error('OCR processing timed out');
    }
  } catch (error: any) {
    console.error('Error getting OCR results:', error);
    
    // Update processing status to error
    await storage.updateCompanyDocument(documentId, {
      status: 'error',
      errorMessage: error.message || 'Error getting OCR results',
      processingCompletedAt: new Date()
    });
    
    const jobStatus = processingJobs.get(documentId);
    if (jobStatus) {
      jobStatus.status = 'error';
      jobStatus.message = error.message || 'Error getting OCR results';
    }
  }
}

/**
 * Extract structured company information using GPT-4o
 */
async function extractCompanyInformation(text: string, userId: number): Promise<any> {
  try {
    const prompt = `
You are an expert AI assistant for extracting structured company information from documents.
Analyze the following text extracted from a company document and identify key information about the business.

Extract the following information in JSON format:
1. companyDescription: A concise description of the company (max 200 words)
2. businessType: The type of business (e.g., LLC, Corporation, etc.)
3. companyActivities: An array of specific business activities/services the company offers
4. mainIndustries: An array of the main industries the company operates in
5. specializations: An array of specialized services or capabilities

Only include fields if you can extract them with high confidence. If information is not available, use null.
Output in valid JSON format with these fields.

Here is the extracted text:
${text.substring(0, 10000)} // Limit to first 10k characters for API limit
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: "You are an AI that extracts structured company information from documents." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    // Parse the extracted information
    const extractedInfo = JSON.parse(completion.choices[0].message.content);
    
    return extractedInfo;
  } catch (error) {
    console.error('Error extracting company information:', error);
    return {
      companyDescription: null,
      businessType: null,
      companyActivities: [],
      mainIndustries: [],
      specializations: []
    };
  }
}

/**
 * Update user profile with extracted company information
 */
async function updateUserProfileWithExtractedData(userId: number, extractedData: any): Promise<void> {
  try {
    // Get existing user profile
    const existingProfile = await storage.getUserProfile(userId);
    
    if (existingProfile) {
      // Update existing profile with extracted data
      await storage.updateUserProfile(userId, {
        companyDescription: extractedData.companyDescription || existingProfile.companyDescription,
        companyActivities: extractedData.companyActivities || existingProfile.companyActivities,
        businessType: extractedData.businessType || existingProfile.businessType,
        mainIndustries: extractedData.mainIndustries || existingProfile.mainIndustries,
        specializations: extractedData.specializations || existingProfile.specializations,
      });
    } else {
      // Create new profile with extracted data
      await storage.createUserProfile({
        userId,
        companyDescription: extractedData.companyDescription,
        companyActivities: extractedData.companyActivities || [],
        businessType: extractedData.businessType,
        mainIndustries: extractedData.mainIndustries || [],
        specializations: extractedData.specializations || [],
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating user profile with extracted data:', error);
  }
}

/**
 * Get document processing status
 */
export function getDocumentStatus(documentId: string): ProcessingJobStatus | null {
  return processingJobs.get(documentId) || null;
}

/**
 * Clean up temporary files
 */
export async function cleanupDocumentFiles(documentId: string): Promise<void> {
  try {
    const jobStatus = processingJobs.get(documentId);
    
    if (jobStatus && jobStatus.filePath) {
      if (fs.existsSync(jobStatus.filePath)) {
        await fsPromises.unlink(jobStatus.filePath);
      }
    }
  } catch (error) {
    console.error('Error cleaning up document files:', error);
  }
}