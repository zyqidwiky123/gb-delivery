
const axios = require('axios');

async function findPlace() {
  const apiKey = 'AIzaSyAMdIaOkJQ8t_rokwEDkBWTJjjw9tmYzUk';
  const query = 'Berubetto Blitar';
  try {
    const response = await axios.get(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`);
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(error);
  }
}

findPlace();
