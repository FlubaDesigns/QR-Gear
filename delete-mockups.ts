import { Client } from "@replit/object-storage";

async function deleteAllMockups() {
  const client = new Client();
  
  try {
    // List all objects
    const result = await client.list();
    if (!result.ok) {
      console.error("Failed to list objects:", result.error);
      return;
    }
    
    const mockupFiles = result.value.filter(obj => obj.name.startsWith("mockup-"));
    console.log(`Found ${mockupFiles.length} mockup files to delete`);
    
    for (const file of mockupFiles) {
      const deleteResult = await client.delete(file.name);
      if (deleteResult.ok) {
        console.log(`Deleted: ${file.name}`);
      } else {
        console.error(`Failed to delete ${file.name}:`, deleteResult.error);
      }
    }
    
    console.log("Done deleting mockup files");
  } catch (error) {
    console.error("Error:", error);
  }
}

deleteAllMockups();
