const { JsonRpcProvider, Contract, ethers } = require("ethers");
const fs = require("fs");

async function main() {
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");
  const abiStr = fs.readFileSync("./src/integrations/contracts/EventTicket.abi.json", "utf8");
  const abi = JSON.parse(abiStr);
  const contractAddress = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";
  
  const contract = new Contract(contractAddress, abi, provider);
  
  try {
    const signer = await provider.getSigner(0);
    console.log("Admin address:", await signer.getAddress());
    
    console.log("\nTrying getOrganizedEvents:");
    const events = await contract.getOrganizedEvents(await signer.getAddress());
    console.log("Organized events:", events.map(e => e.toString()));
    
    if (events.length > 0) {
      console.log("\nTrying getEvent(0):");
      const event0 = await contract.getEvent(BigInt(events[0].toString()));
      console.log("Event 0:", event0.name);
    } else {
      console.log("\nNo events found for this organizer. Let's create one!");
      const tx = await contract.connect(signer).createEvent(
        "Direct Script Test",
        "Test description",
        Math.floor(Date.now() / 1000) + 86400, // tomorrow
        "Location",
        100,
        ethers.parseEther("0.1"),
        0
      );
      const receipt = await tx.wait();
      console.log("Created event, transaction hash:", receipt.hash);
      
      const newEvents = await contract.getOrganizedEvents(await signer.getAddress());
      console.log("Organized events now:", newEvents.map(e => e.toString()));
      
      if (newEvents.length > 0) {
        console.log("\nTrying getEvent:", newEvents[0].toString());
        const eventId = BigInt(newEvents[newEvents.length - 1].toString());
        const event0 = await contract.getEvent(eventId);
        console.log("Event retrieved successfully:", event0.name);
      }
    }
  } catch (error) {
    console.error("ERROR:", error.message);
    if (error.data) console.error("Error data:", error.data);
  }
}

main();