import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

  const getSpotifyToken = async () => {
  const clientId = "0783e38226d445b3824f43890b4fb343";
  const clientSecret = "ac2bda6decec494da6100df89210a898";

  const authOptions = {
    method: "POST",
    url: "https://accounts.spotify.com/api/token",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  };

  try {
    const response = await axios(authOptions);
    return response.data.access_token;
  } catch (error) {
    console.error("Error fetching Spotify token:", error.response?.data || error.message);
    throw error;
  }
};

export default getSpotifyToken;