// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title EventTicket
 * @dev A comprehensive ERC721-based smart contract for event ticketing with secondary market support
 */
contract EventTicket is ERC721, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    using Strings for uint256;

    // Token counter for unique ticket IDs
    Counters.Counter private tokenIdCounter;
    Counters.Counter private eventIdCounter;

    // Structs
    struct Event {
        uint256 eventId;
        address organizer;
        string name;
        string description;
        uint256 eventDate;
        string location;
        uint256 totalCapacity;
        uint256 ticketsSold;
        uint256 basePrice;
        bool cancelled;
        uint256 createdAt;
    }

    struct Ticket {
        uint256 tokenId;
        uint256 eventId;
        bool checkedIn;
        uint256 checkedInAt;
        address originalOwner;
        uint256 resalePrice;
        bool isForSale;
    }

    struct ResaleOffer {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
    }

    // State variables
    mapping(uint256 => Event) public events;
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => ResaleOffer) public resaleOffers;
    mapping(address => uint256[]) public userEvents; // Events organized by address
    mapping(address => uint256[]) public userTickets; // Tickets owned by address
    mapping(bytes32 => bool) public checkedInHashes; // Prevent duplicate check-ins

    // Base URI for NFT metadata (optional external override)
    string private _baseTokenURI;

    // Fee structure
    uint256 public platformFeePercentage = 5; // 5% platform fee
    uint256 public platformBalance = 0;

    // Events
    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        string name,
        uint256 eventDate,
        uint256 capacity
    );

    event TicketMinted(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        address indexed to,
        uint256 price
    );

    event TicketCheckedIn(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        address indexed attendee
    );

    event ResaleOffered(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );

    event ResaleCompleted(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 price
    );

    event ResaleOfferCancelled(uint256 indexed tokenId);

    // Modifiers
    modifier eventExists(uint256 _eventId) {
        require(_eventId < eventIdCounter.current(), "Event does not exist");
        _;
    }

    modifier ticketExists(uint256 _tokenId) {
        require(_exists(_tokenId), "Ticket does not exist");
        _;
    }

    modifier onlyEventOrganizer(uint256 _eventId) {
        require(events[_eventId].organizer == msg.sender, "Only organizer can perform this action");
        _;
    }

    modifier onlyTicketOwner(uint256 _tokenId) {
        require(ownerOf(_tokenId) == msg.sender, "Only ticket owner can perform this action");
        _;
    }

    modifier eventNotCancelled(uint256 _eventId) {
        require(!events[_eventId].cancelled, "Event is cancelled");
        _;
    }

    // Constructor
    constructor() ERC721("FairPass Ticket", "TICKET") {}

    // ============ Event Management ============

    /**
     * @dev Create a new event
     */
    function createEvent(
        string memory _name,
        string memory _description,
        uint256 _eventDate,
        string memory _location,
        uint256 _capacity,
        uint256 _basePrice
    ) public returns (uint256) {
        require(_eventDate > block.timestamp, "Event date must be in the future");
        require(_capacity > 0, "Capacity must be greater than 0");
        require(bytes(_name).length > 0, "Name cannot be empty");

        uint256 eventId = eventIdCounter.current();
        eventIdCounter.increment();

        events[eventId] = Event({
            eventId: eventId,
            organizer: msg.sender,
            name: _name,
            description: _description,
            eventDate: _eventDate,
            location: _location,
            totalCapacity: _capacity,
            ticketsSold: 0,
            basePrice: _basePrice,
            cancelled: false,
            createdAt: block.timestamp
        });

        userEvents[msg.sender].push(eventId);

        emit EventCreated(eventId, msg.sender, _name, _eventDate, _capacity);
        return eventId;
    }

    /**
     * @dev Cancel an event (organizer only)
     */
    function cancelEvent(uint256 _eventId) 
        public 
        eventExists(_eventId)
        onlyEventOrganizer(_eventId)
    {
        require(!events[_eventId].cancelled, "Event already cancelled");
        events[_eventId].cancelled = true;
    }

    /**
     * @dev Get event details
     */
    function getEvent(uint256 _eventId)
        public
        view
        eventExists(_eventId)
        returns (Event memory)
    {
        return events[_eventId];
    }

    // ============ Ticket Operations ============

    /**
     * @dev Mint a new ticket for an event
     */
    function mintTicket(uint256 _eventId, address _to)
        public
        payable
        eventExists(_eventId)
        eventNotCancelled(_eventId)
        nonReentrant
        returns (uint256)
    {
        Event storage eventData = events[_eventId];
        require(eventData.ticketsSold < eventData.totalCapacity, "Event is sold out");
        require(msg.value >= eventData.basePrice, "Insufficient payment");

        uint256 tokenId = tokenIdCounter.current();
        tokenIdCounter.increment();

        // Mint the NFT
        _safeMint(_to, tokenId);

        // Create ticket record
        tickets[tokenId] = Ticket({
            tokenId: tokenId,
            eventId: _eventId,
            checkedIn: false,
            checkedInAt: 0,
            originalOwner: _to,
            resalePrice: 0,
            isForSale: false
        });

        eventData.ticketsSold++;
        userTickets[_to].push(tokenId);

        // Handle payment
        uint256 fee = (msg.value * platformFeePercentage) / 100;
        uint256 organizerPayment = msg.value - fee;
        platformBalance += fee;

        // Transfer payment to organizer
        (bool success, ) = eventData.organizer.call{value: organizerPayment}("");
        require(success, "Payment transfer failed");

        // Refund excess payment
        if (msg.value > eventData.basePrice) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - eventData.basePrice}("");
            require(refundSuccess, "Refund failed");
        }

        emit TicketMinted(tokenId, _eventId, _to, eventData.basePrice);
        return tokenId;
    }

    /**
     * @dev Check in a ticket
     */
    function checkInTicket(uint256 _tokenId, string calldata /* _ipfsHash */)
        public
        ticketExists(_tokenId)
        eventNotCancelled(tickets[_tokenId].eventId)
        nonReentrant
    {
        Ticket storage ticket = tickets[_tokenId];
        require(!ticket.checkedIn, "Ticket already checked in");
        require(ownerOf(_tokenId) == msg.sender || events[ticket.eventId].organizer == msg.sender, "Unauthorized");

        bytes32 checkInHash = keccak256(abi.encodePacked(_tokenId, block.timestamp));
        require(!checkedInHashes[checkInHash], "Check-in already recorded");

        ticket.checkedIn = true;
        ticket.checkedInAt = block.timestamp;
        checkedInHashes[checkInHash] = true;

        emit TicketCheckedIn(_tokenId, ticket.eventId, msg.sender);
    }

    /**
     * @dev Verify if a ticket has been checked in
     */
    function isCheckedIn(uint256 _tokenId)
        public
        view
        ticketExists(_tokenId)
        returns (bool)
    {
        return tickets[_tokenId].checkedIn;
    }

    /**
     * @dev Get ticket details
     */
    function getTicket(uint256 _tokenId)
        public
        view
        ticketExists(_tokenId)
        returns (Ticket memory)
    {
        return tickets[_tokenId];
    }

    // ============ Secondary Market (Resale) ============

    /**
     * @dev List a ticket for resale
     */
    function listForResale(uint256 _tokenId, uint256 _price)
        public
        ticketExists(_tokenId)
        onlyTicketOwner(_tokenId)
    {
        require(_price > 0, "Price must be greater than 0");
        require(!tickets[_tokenId].checkedIn, "Cannot resale checked-in ticket");

        tickets[_tokenId].isForSale = true;
        tickets[_tokenId].resalePrice = _price;

        resaleOffers[_tokenId] = ResaleOffer({
            tokenId: _tokenId,
            seller: msg.sender,
            price: _price,
            active: true
        });

        emit ResaleOffered(_tokenId, msg.sender, _price);
    }

    /**
     * @dev Cancel a resale listing
     */
    function cancelResale(uint256 _tokenId)
        public
        ticketExists(_tokenId)
        onlyTicketOwner(_tokenId)
    {
        require(tickets[_tokenId].isForSale, "Ticket is not for sale");

        tickets[_tokenId].isForSale = false;
        resaleOffers[_tokenId].active = false;

        emit ResaleOfferCancelled(_tokenId);
    }

    /**
     * @dev Purchase a ticket from resale market
     */
    function buyFromResale(uint256 _tokenId)
        public
        payable
        ticketExists(_tokenId)
        nonReentrant
    {
        Ticket storage ticket = tickets[_tokenId];
        ResaleOffer storage offer = resaleOffers[_tokenId];

        require(offer.active, "Ticket is not for sale");
        require(msg.value >= offer.price, "Insufficient payment");
        require(msg.sender != offer.seller, "Cannot buy your own ticket");
        require(!ticket.checkedIn, "Cannot buy checked-in ticket");

        address seller = offer.seller;

        // Calculate fees
        uint256 fee = (msg.value * platformFeePercentage) / 100;
        uint256 sellerPayment = msg.value - fee;
        platformBalance += fee;

        // Update ticket
        ticket.isForSale = false;
        offer.active = false;

        // Transfer NFT
        _transfer(seller, msg.sender, _tokenId);

        // Update user tickets
        removeFromArray(userTickets[seller], _tokenId);
        userTickets[msg.sender].push(_tokenId);

        // Transfer payment to seller
        (bool success, ) = seller.call{value: sellerPayment}("");
        require(success, "Payment transfer failed");

        // Refund excess
        if (msg.value > offer.price) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - offer.price}("");
            require(refundSuccess, "Refund failed");
        }

        emit ResaleCompleted(_tokenId, seller, msg.sender, offer.price);
    }

    /**
     * @dev Get resale offer details
     */
    function getResaleOffer(uint256 _tokenId)
        public
        view
        returns (ResaleOffer memory)
    {
        return resaleOffers[_tokenId];
    }

    // ============ User Management ============

    /**
     * @dev Get all events organized by an address
     */
    function getOrganizedEvents(address _organizer)
        public
        view
        returns (uint256[] memory)
    {
        return userEvents[_organizer];
    }

    /**
     * @dev Get all tickets owned by an address
     */
    function getUserTickets(address _owner)
        public
        view
        returns (uint256[] memory)
    {
        return userTickets[_owner];
    }

    /**
     * @dev Get all tickets for a specific event
     */
    function getEventTickets(uint256 _eventId)
        public
        view
        eventExists(_eventId)
        returns (uint256[] memory)
    {
        uint256 totalSupply = tokenIdCounter.current();
        uint256 count = 0;

        // Count tickets for this event
        for (uint256 i = 0; i < totalSupply; i++) {
            if (_exists(i) && tickets[i].eventId == _eventId) {
                count++;
            }
        }

        uint256[] memory eventTickets = new uint256[](count);
        uint256 index = 0;

        // Fill array with tickets for this event
        for (uint256 i = 0; i < totalSupply; i++) {
            if (_exists(i) && tickets[i].eventId == _eventId) {
                eventTickets[index] = i;
                index++;
            }
        }

        return eventTickets;
    }

    // ============ Admin Functions ============

    /**
     * @dev Withdraw platform fees
     */
    function withdrawPlatformFees()
        public
        onlyOwner
        nonReentrant
    {
        uint256 amount = platformBalance;
        require(amount > 0, "No fees to withdraw");

        platformBalance = 0;

        (bool success, ) = owner().call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Set platform fee percentage
     */
    function setPlatformFeePercentage(uint256 _percentage)
        public
        onlyOwner
    {
        require(_percentage <= 20, "Fee cannot exceed 20%");
        platformFeePercentage = _percentage;
    }

    /**
     * @dev Get contract balance information
     */
    function getContractBalance()
        public
        view
        returns (uint256 totalBalance, uint256 feesCollected)
    {
        return (address(this).balance, platformBalance);
    }

    // ============ Helper Functions ============

    /**
     * @dev Check if a token exists
     */
    function _exists(uint256 tokenId) internal view override returns (bool) {
        try this.ownerOf(tokenId) returns (address) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Remove item from array
     */
    function removeFromArray(uint256[] storage array, uint256 value) internal {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == value) {
                array[i] = array[array.length - 1];
                array.pop();
                break;
            }
        }
    }

    // ============ NFT Metadata (On-Chain) ============

    /**
     * @dev On-chain NFT metadata returned for every token.
     *      Generates a Base64-encoded JSON with an embedded SVG image.
     */
    struct NFTMetadata {
        string  name;
        uint256 tokenId;
        uint256 eventId;
        string  eventName;
        string  eventLocation;
        uint256 eventDate;
        address currentOwner;
        address originalOwner;
        bool    checkedIn;
        uint256 checkedInAt;
        bool    isForSale;
        uint256 resalePrice;
    }

    /**
     * @dev Return structured on-chain NFT data for the given token.
     */
    function getNFTMetadata(uint256 _tokenId)
        public
        view
        ticketExists(_tokenId)
        returns (NFTMetadata memory)
    {
        Ticket memory ticket = tickets[_tokenId];
        Event  memory evt    = events[ticket.eventId];
        return NFTMetadata({
            name:          string(abi.encodePacked(evt.name, " #", _tokenId.toString())),
            tokenId:       _tokenId,
            eventId:       ticket.eventId,
            eventName:     evt.name,
            eventLocation: evt.location,
            eventDate:     evt.eventDate,
            currentOwner:  ownerOf(_tokenId),
            originalOwner: ticket.originalOwner,
            checkedIn:     ticket.checkedIn,
            checkedInAt:   ticket.checkedInAt,
            isForSale:     ticket.isForSale,
            resalePrice:   ticket.resalePrice
        });
    }

    /**
     * @dev Allow the contract owner to set a base URI for off-chain metadata.
     *      If non-empty, tokenURI returns baseURI+tokenId instead of on-chain SVG.
     */
    function setBaseURI(string memory baseURI_) public onlyOwner {
        _baseTokenURI = baseURI_;
    }

    /**
     * @dev Override ERC721 _baseURI to support external metadata servers.
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev On-chain tokenURI — returns Base64-encoded JSON+SVG metadata.
     *      Falls back to baseURI+id when a base URI is configured.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        ticketExists(tokenId)
        returns (string memory)
    {
        // If an external base URI is set, delegate to the default ERC721 behaviour
        string memory base = _baseURI();
        if (bytes(base).length > 0) {
            return string(abi.encodePacked(base, tokenId.toString()));
        }

        Ticket memory ticket = tickets[tokenId];
        Event  memory evt    = events[ticket.eventId];

        // ---- Build SVG image ----
        string memory statusLabel = ticket.checkedIn ? "CHECKED IN" : "VALID";
        string memory statusColor = ticket.checkedIn ? "#86efac" : "#818cf8";
        string memory statusBg    = ticket.checkedIn ? "#14532d" : "#1e1b4b";

        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 250">',
            '<rect width="500" height="250" rx="16" fill="#0a0a1a"/>',
            '<rect x="1.5" y="1.5" width="497" height="247" rx="15" fill="none" stroke="#6366f1" stroke-width="1.5"/>',
            '<rect x="0" y="0" width="500" height="5" rx="2" fill="#6366f1"/>',
            '<text x="24" y="48" font-family="monospace" font-size="11" fill="#818cf8">FAIRPASS NFT TICKET</text>',
            '<text x="24" y="80" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="white">', evt.name, '</text>',
            '<text x="24" y="106" font-family="Arial,sans-serif" font-size="13" fill="#a78bfa">', evt.location, '</text>',
            '<rect x="378" y="22" width="98" height="32" rx="6" fill="#1e1b4b"/>',
            '<text x="427" y="43" font-family="monospace" font-size="13" fill="#818cf8" text-anchor="middle">#', tokenId.toString(), '</text>',
            '<line x1="24" y1="128" x2="476" y2="128" stroke="#1e1b4b" stroke-width="1"/>',
            '<text x="24" y="158" font-family="monospace" font-size="10" fill="#4b5563">TOKEN ID: ', tokenId.toString(), '</text>',
            '<text x="24" y="176" font-family="monospace" font-size="10" fill="#4b5563">STANDARD: ERC-721</text>',
            '<rect x="374" y="148" width="102" height="28" rx="14" fill="', statusBg, '"/>',
            '<text x="425" y="167" font-family="Arial,sans-serif" font-size="11" fill="', statusColor, '" text-anchor="middle">', statusLabel, '</text>',
            '<text x="24" y="232" font-family="monospace" font-size="9" fill="#374151">Powered by FairPass Protocol | ERC-721</text>',
            '</svg>'
        ));

        string memory svgEncoded = Base64.encode(bytes(svg));

        // ---- Build JSON attributes ----
        string memory attributes = string(abi.encodePacked(
            '[',
            '{"trait_type":"Event","value":"',       evt.name,           '"},',
            '{"trait_type":"Location","value":"',    evt.location,       '"},',
            '{"trait_type":"Token ID","value":"',    tokenId.toString(), '"},',
            '{"trait_type":"Status","value":"',      statusLabel,        '"},',
            '{"trait_type":"Standard","value":"ERC-721"},',
            '{"display_type":"date","trait_type":"Event Date","value":', evt.eventDate.toString(), '}',
            ']'
        ));

        // ---- Assemble metadata JSON ----
        string memory tokenName = string(abi.encodePacked(evt.name, " #", tokenId.toString()));
        string memory description = string(abi.encodePacked(
            "FairPass NFT Ticket for ", evt.name, ". Venue: ", evt.location, "."
        ));

        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{',
            '"name":"',        tokenName,   '",',
            '"description":"', description, '",',
            '"image":"data:image/svg+xml;base64,', svgEncoded, '",',
            '"attributes":', attributes,
            '}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    /**
     * @dev Handle incoming ETH
     */
    receive() external payable {}
}
