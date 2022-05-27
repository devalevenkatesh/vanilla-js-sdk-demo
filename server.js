const http = require('http');
const AWS = require('aws-sdk');
const { v4: uuidV4 } = require('uuid');
const url = require('url');

const chime = new AWS.Chime({ region: 'us-east-1' });
chime.endpoint = new AWS.Endpoint('https://service.chime.aws.amazon.com/console');

const hostname = '127.0.0.1';
const port = 8080;

// Store created meetings in a map so attendees can join by meeting title.
const meetingTable = {};

const server = http.createServer(async (req, res) => {
  const parsedURL = url.parse(req.url, true);
  if (req.method === 'POST' && parsedURL.pathname === '/join') {
    handleJoinRequest(parsedURL.query.meetingName, parsedURL.query.attendeeName, res);
  }
});

const handleJoinRequest = async (meetingName, attendeeName, res) => {
  console.log('handleJoinRequest - Meeting details', meetingName, attendeeName);
  try {
    // Look up the meeting by its title. If it does not exist, create the meeting.
      if (!meetingTable[meetingName]) {
        meetingTable[meetingName] = await chime.createMeeting({
          // Use a UUID for the client request token to ensure that any request retries
          // do not create multiple meetings.
          ClientRequestToken: uuidV4(),
          // Specify the media region (where the meeting is hosted).
          // In this case, we use the region selected by the user.
          MediaRegion: 'us-east-1',
          // Any meeting ID you wish to associate with the meeting.
          // For simplicity here, we use the meeting title.
          ExternalMeetingId: meetingName.substring(0, 64),
        }).promise();
      }

    // Fetch the meeting info
    const meeting = meetingTable[meetingName];
    
    // Create new attendee for the meeting
    const attendee = await chime.createAttendee({
      // The meeting ID of the created meeting to add the attendee to
      MeetingId: meeting.Meeting.MeetingId,

      // Any user ID you wish to associate with the attendeee.
      // For simplicity here, we use a random id for uniqueness
      // combined with the name the user provided, which can later
      // be used to help build the roster.
      ExternalUserId: attendeeName,
    }).promise();

    console.log('CreateAttendee Success');
    respond(res, 200, {meeting, attendee});
  } catch (error) {
    console.log('Error creating meeting or attendee', error);
    respond(res, 503, null);
  }
}

const respond = (res, statusCode, data) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(data));
}

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});