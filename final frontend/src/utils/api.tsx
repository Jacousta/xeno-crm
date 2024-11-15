const API_URL =
  process.env.NEXT_PUBLIC_PROD_BACKEND_API_URL || "http://localhost:5001/api";

export const fetchCampaigns = async () => {
  try {
    const response = await fetch(`${API_URL}/campaigns`);
    if (!response.ok) {
      throw new Error("Failed to fetch campaigns");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    throw error;
  }
};

export const createCampaign = async (audience: object) => {
  try {
    const response = await fetch(`${API_URL}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(audience),
    });
    console.log(response)
    const data = await response.json()
    if (!response.ok) {
      console.log(data)
      throw new Error("Failed to create audience.." + data);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return;
    }
    console.error("Error creating audience:", error);
    throw error;
  }
};

export const checkAudienceSize = async (audience: object) => {
  try {
    const response = await fetch(`${API_URL}/audiences/size`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(audience),
    });
    if (!response.ok) {
      throw new Error("Failed to check audience size");
    }
    const data = await response.json();
    return data.size;
  } catch (error) {
    console.error("Error checking audience size:", error);
    throw error;
  }
};
