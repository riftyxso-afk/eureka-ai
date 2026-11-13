/** Keep AI output separate from the room input: sending it back makes the tutor hear itself. */
export function createMeetAudio(context:AudioContext,local:MediaStream){
 const output=context.createMediaStreamDestination(),input=context.createMediaStreamDestination(),uplink=context.createMediaStreamDestination();
 const inputs=new Map<string,MediaStreamAudioSourceNode>();
 const self=context.createMediaStreamSource(new MediaStream(local.getAudioTracks()));self.connect(input);self.connect(uplink);inputs.set('self',self);
 const tutorSource=context.createMediaStreamSource(output.stream);tutorSource.connect(uplink);
 return {context,output,input,uplink,tutorSource,inputs,source:undefined as MediaStreamAudioSourceNode|undefined};
}
