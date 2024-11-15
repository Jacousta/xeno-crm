const { getDB } = require("../config/db");
const { publishToQueue } = require("../services/pubsubService");
const { getAudienceSizeHandler } = require("./audienceController");
const { sendToVendorAPI } = require("../services/vendorApi");

const createCampaign = async (req, res) => {
  const { campaignName, campaignMessage, rules } = req.body;
  console.log(req.body)
  const db = getDB();
  if (!db) {
    throw new Error("Database connection failed");
  }

  try {
    const audienceSize = await getAudienceSizeHandler(rules);

    const communicationLog = {
      campaignName,
      campaignMessage,
      audienceRules: rules, //[{},{}]
      audienceSize,
      deliveryStatus: "Pending",
      createdAt: new Date(),
      sentCount: 0,
      failedCount: 0,
    };

    const result = await db
      .collection("communication_log")
      .insertOne(communicationLog);

      console.log("___________",result)
    const communicationId = result.insertedId;
    await sendCampaignMessagesInternal(communicationId);

    res
      .status(201)
      .json({message:"Communication log created and messages are being sent"});
  } catch (error) {
    res.status(500).json({ error });
  }
};

const sendCampaignMessagesInternal = async (communicationId) => {
  const db = getDB();
  const communicationLog = await db
    .collection("communication_log")
    .findOne({ _id: communicationId });

  if (!communicationLog) {
    throw new Error("Communication log not found");
  }

  const { audienceRules, campaignMessage } = communicationLog;
  console.log(audienceRules)
  let audience = [];
  if (!audienceRules || audienceRules.length === 0) {
    audience = await db.collection("customers").find().toArray();
  } else {
    console.log("queryyy")
    const mongoQuery = parseAudienceRules(audienceRules);
    console.log("Parsed MongoDB query:", mongoQuery);
    console.log(
      "Sending messages to audience:",
      JSON.stringify("***",audienceRules, null, 2)
    );
    console.log("MongoDB Query:", JSON.stringify(mongoQuery, null, 2));
    audience = await db
      .collection("customers")
      .find({ $and: mongoQuery })
      .toArray();
  }

  console.log("Audience size:", audience.length);

  const messages = audience.map((customer) => ({
    customerId: customer._id,
    message: campaignMessage.replace("{customer_name}", customer.name),
  }));

  for (const message of messages) {
    await sendToVendorAPI(message.message, communicationId, message.customerId);
  }
};

const getCampaigns = async (req, res) => {
  const db = getDB();
  const communications = await db
    .collection("communication_log")
    .find()
    .sort({ createdAt: -1 })
    .toArray();
  res.status(200).json(communications);
};

const parseAudienceRules = (rules) => {
  // Ensure rules is an array
  if (!Array.isArray(rules)) {
    throw new Error("Expected 'rules' to be an array");
  }

  const mongoQuery = rules.map((rule) => {
    const { field, operator, value } = rule;

    // Validate the rule structure
    if (!field || !operator || value === undefined) {
      throw new Error(`Invalid rule format: ${JSON.stringify(rule)}`);
    }

    let mongoOperator;
    let parsedValue = value;

    // Map the operator to MongoDB's operator
    switch (operator) {
      case ">":
        mongoOperator = "$gt";
        break;
      case ">=":
        mongoOperator = "$gte";
        break;
      case "<":
        mongoOperator = "$lt";
        break;
      case "<=":
        mongoOperator = "$lte";
        break;
      case "==":
        mongoOperator = "$eq";
        break;
      case "!=":
        mongoOperator = "$ne";
        break;
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }

    // Handle special field types (e.g., date)
    if (field === "last_visit") {
      parsedValue = new Date(value);
      if (isNaN(parsedValue)) {
        throw new Error(`Invalid date format for last_visit: ${value}`);
      }
    } else {
      // For numeric fields, ensure value can be parsed into a float
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        throw new Error(`Invalid numeric value for field "${field}": ${value}`);
      }
    }

    // Return the MongoDB query part for the field
    return { [field]: { [mongoOperator]: parsedValue } };
  });

  return mongoQuery;
};
module.exports = { createCampaign, getCampaigns };
