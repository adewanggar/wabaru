const axios = require('axios');

async function testOllama() {
  try {
    console.log('Testing Llama 3...');
    const responseLlama = await axios.post('http://localhost:3000/api/genai/generate-message', {
      prompt: 'Why is the sky blue?',
      provider: 'ollama',
      model: 'llama3:8b'
    });
    console.log('Llama 3 Response:', responseLlama.data.text);

    console.log('\nTesting Mistral...');
    const responseMistral = await axios.post('http://localhost:3000/api/genai/generate-message', {
      prompt: 'What is the capital of France?',
      provider: 'ollama',
      model: 'mistral'
    });
    console.log('Mistral Response:', responseMistral.data.text);

  } catch (error) {
    console.error('Error testing Ollama:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    console.log('\nMake sure:');
    console.log('1. The backend server is running (port 3000)');
    console.log('2. Ollama is running (ollama serve)');
    console.log('3. You have pulled the models (ollama pull llama3:8b && ollama pull mistral)');
  }
}

testOllama();
