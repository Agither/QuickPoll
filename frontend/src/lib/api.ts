// Zentrale API-Konfiguration und Methoden für QuickPoll

import { getSessionId } from './session';

const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://quickpoll.up.railway.app' 
  : 'http://localhost:8000';

// Type Definitions
export interface Survey {
  id: string;
  title: string;
  description?: string;
  status: 'ready' | 'active' | 'finished';
  created_at: string;
  expires_at: string;
  response_count: number;
  questions: Question[];
}

export interface Question {
  id: string;
  survey_id: string;
  title: string;
  type: 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'yes_no';
  options?: string[];
  required: boolean;
  description?: string;
  order: number;
}

export interface AnswerSubmission {
  question_id: string;
  answer: string | string[] | number | boolean;
}

export interface ResponseSubmission {
  survey_id: string;
  answers: AnswerSubmission[];
  participant_name?: string;
}

export interface Response {
  id: string;
  survey_id: string;
  answers: AnswerSubmission[];
  participant_name?: string;
  submitted_at: string;
}

// Health Check Response Type
export interface HealthResponse {
  status: string;
  database: string;
  surveys_count: number;
  responses_count: number;
  timestamp: string;
}

// Basis-Fetch-Funktion mit Fehlerbehandlung
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  // Session-ID zu Headers hinzufügen
  const sessionId = getSessionId();
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId,
      ...options.headers,
    },
    // credentials: 'include', // Disabled for CORS compatibility
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }
    
    return response.json() as T;
  } catch (error) {
    console.error(`API Request failed for ${url}:`, error);
    throw error;
  }
}

// Health Check
export async function checkHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health');
}

// Survey CRUD Operations
export async function createSurvey(surveyData: Omit<Survey, 'id' | 'created_at' | 'expires_at' | 'response_count'>): Promise<Survey> {
  return apiRequest<Survey>('/surveys/', {
    method: 'POST',
    body: JSON.stringify(surveyData),
  });
}

export async function getSurvey(surveyId: string): Promise<Survey> {
  return apiRequest<Survey>(`/surveys/${surveyId}`);
}

export async function getPublicSurvey(surveyId: string): Promise<Survey> {
  return apiRequest<Survey>(`/public/surveys/${surveyId}`);
}

export async function getAllSurveys(): Promise<Survey[]> {
  return apiRequest<Survey[]>('/surveys/');
}

// Alias für Rückwärtskompatibilität
export const getSurveys = getAllSurveys;

export async function updateSurvey(surveyId: string, surveyData: Partial<Survey>): Promise<Survey> {
  return apiRequest<Survey>(`/surveys/${surveyId}`, {
    method: 'PUT',
    body: JSON.stringify(surveyData),
  });
}

export async function deleteSurvey(surveyId: string): Promise<void> {
  return apiRequest<void>(`/surveys/${surveyId}`, {
    method: 'DELETE',
  });
}

// Question Operations
export async function addQuestion(surveyId: string, questionData: Omit<Question, 'id' | 'survey_id'>): Promise<Question> {
  return apiRequest<Question>(`/surveys/${surveyId}/questions/`, {
    method: 'POST',
    body: JSON.stringify(questionData),
  });
}

export async function updateQuestion(questionId: string, questionData: Partial<Question>): Promise<Question> {
  return apiRequest<Question>(`/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(questionData),
  });
}

export async function deleteQuestion(questionId: string): Promise<void> {
  return apiRequest<void>(`/questions/${questionId}`, {
    method: 'DELETE',
  });
}

// Response Operations
export async function getSurveyResponses(surveyId: string): Promise<Response[]> {
  return apiRequest<Response[]>(`/surveys/${surveyId}/responses/`);
}

export async function submitSurveyResponse(responseData: ResponseSubmission): Promise<Response> {
  return apiRequest(`/responses/`, {
    method: 'POST',
    body: JSON.stringify(responseData),
  });
}

/**
 * Status einer Umfrage ändern
 */
export async function updateSurveyStatus(surveyId: string, status: 'ready' | 'active' | 'finished'): Promise<Survey> {
  return apiRequest(`/surveys/${surveyId}/status?status=${status}`, {
    method: 'PUT',
  });
}

/**
 * Umfrage-Ergebnisse als Excel exportieren
 */
export async function exportSurveyToExcel(surveyId: string): Promise<Blob> {
  const response = await fetch(`${BASE_URL}/surveys/${surveyId}/export/`, {
    method: 'GET',
    headers: {
      'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.blob();
}
