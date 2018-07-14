//iso base media file format - ISO/IEC 14496-12:2015 – MPEG-4 Part 12
//mp4 file format - ISO/IEC 14496-14:2003 – MPEG-4 Part 14
//W3C ISO BMFF Byte Stream Format

var isString = str => typeof str === 'string' || str instanceof String
var isArray = array => Array.isArray(array)
var isObject = obj => typeof obj === 'object' && !isArray(obj)

function getLength(item){
  var length = 0
  item.forEach(elem=>{
    if(isString(elem)){
      length+= 4
    }
    else if(isObject(elem)){
      var keys = Object.keys(elem)
      var value = elem[keys[0] == "size" && keys[1] || keys[0]]
      if(isArray(value)){
        length+= value.length*elem.size/8
      }
      else if(isString(value) && elem.size==Infinity){
        length+= value.length+1
      }
      else{
        length+= elem.size/8
      }
    }
    else if(isArray(elem)){
      length+= getLength(elem)
    }
  })
  if(isString(item[0])){
    length = length + 4
    item.unshift({length: length, size: 32})
  }
  return length
}

function setString(str, buffer, offset){
  buffer.set(str.split('').map(c=>c.charCodeAt(0)), offset)
}
function setUint(number, size, buffer, offset){
  var arr32 = new Uint32Array(1)
  var view = new Uint8Array(arr32.buffer)
  arr32.set([number])
  buffer.set(view.slice(0,size/8).reverse(), offset)
}

function write(item, buffer, offset){
  if(isString(item)){
    setString(item, buffer, offset)
    offset+= 4
  }
  else if(isObject(item)){
    var keys = Object.keys(item)
    var value = item[keys[0] == "size" && keys[1] || keys[0]]
    if(isArray(value)){
      value.forEach(elem=>{ 
        setUint(elem, item.size, buffer, offset)
        offset+= item.size/8
      })
    }
    else if(isString(value) && item.size==Infinity){
      setString(value+String.fromCharCode(0), buffer, offset)
      offset+= value.length+1
    }
    else if(isString(value)){
      setString(value, buffer, offset)
      offset+= item.size/8
    }
    else{
      setUint(value, item.size, buffer, offset)
      offset+= item.size/8
    }
  }
  else if(isArray(item)){
    offset = item.reduce((acc,item)=>write(item, buffer, acc), offset)
  }
  return offset
}

function getHeader(samplingRate, samplesPerFrame, frameLength, avgBitrate, maxBitrate){

  var head = [
    ["ftyp", 
      {major_brand:"mp42", size:32},
      {minor_version:1, size:32},
      {compatible_brand:"isom", size:32},
      {compatible_brand:"mp42", size:32}
    ],
    ["moov", 
      ["mvhd",
        {version:0, size:8},
        {flags:0, size:24},
        {creation_time:0, size:32},
        {modification_time:0, size:32},
        {timescale: samplingRate , size:32},
        {duration:0, size:32},
        {rate:0x00010000, size:32},
        {volume:0x0100, size:16},
        {reserved:0, size:16},
        {reserved:[0,0], size:32},
        {matrix:[0x00010000,0,0,0,0x00010000,0,0,0,0x40000000], size:32},
        {pre_defined:[0,0,0,0,0,0], size:32},
        {next_track_ID:1, size:32}
      ],
      ["mvex",
        ["trex",
          {version:0, size:8},
          {flags:0, size:24},
          {track_ID:1, size:32},
          {default_sample_description_index:1, size:32},
          {default_sample_duration: samplesPerFrame , size:32},
          {default_sample_size:0, size:32},
          {default_sample_flags:0, size:32}
        ]
      ],
      ["trak",
        ["tkhd",
          {version:0, size:8},
          {flags:0x000001, size:24},
          {creation_time:0, size:32},
          {modification_time:0, size:32},
          {track_ID:1, size:32},
          {reserved:0, size:32},
          {duration:0, size:32},
          {reserved:[0,0], size:32},
          {layer:0, size:16},
          {alternate_group:0, size:16},
          {volume:0x0100, size:16},
          {reserved:0, size:16},
          {matrix:[0x00010000,0,0,0,0x00010000,0,0,0,0x40000000], size:32},
          {width:0, size:32},
          {height:0, size:32}
        ],
        ["mdia",
          ["mdhd",
            {version:0, size:8},
            {flags:0, size:24},
            {creation_time:0, size:32},
            {modification_time:0, size:32},
            {timescale: samplingRate , size:32},
            {duration:0, size:32},
            {language:0x55c4, size:16},
            {pre_defined:0, size:16}
          ],
          ["hdlr",
            {version:0, size:8},
            {flags:0, size:24},
            {pre_defined:0, size:32},
            {handler_type:"soun", size:32},
            {reserved: [0,0,0], size:32},
            {name:"handler name", size:Infinity},
          ],
          ["minf",
            ["smhd",
              {version:0, size:8},
              {flags:0, size:24},
              {balance:0, size:16},
              {reserved:0, size:16}
            ],
            ["dinf",
              ["dref",
                {version:0, size:8},
                {flags:0, size:24},
                {entry_count:1, size:32},
                ["url ",
                  {version:0, size:8},
                  {flags:0x000001, size:24}
                ]
              ]
            ],
            ["stbl",
              ["stsd",
                {version:0, size:8},
                {flags:0, size:24},
                {entry_count: 1, size:32},
                ["mp4a",
                  {reserved:[0,0,0], size:16},
                  {data_reference_index:1, size:16},
                  {reserved:[0,0], size:32},
                  {channel_count: 2,size:16},
                  {sample_size:16, size:16},
                  {reserved:0, size:32},
                  {sample_rate: samplingRate , size:16},
                  {reserved:0, size:16},
                  ["esds",
                    {version:0, size:8},
                    {flags:0, size:24},
                    [
                      {tag:0x03, size:8},
                      {length:21, size:8},
                      {es_id:0, size:16},
                      {stream_priority:0, size:8},
                      [
                        {tag:0x04, size:8},
                        {length:13, size:8},
                        {object_type_indication:0x6b, size:8},
                        {stream_type:(0x05 << 2)+1, size:8},
                        {buffer_size_db: frameLength , size:24},
                        {max_bitrate: maxBitrate , size:32},
                        {avg_bitrate: avgBitrate , size:32}
                      ],
                      [
                        {tag:0x06, size:8},
                        {length:1, size:8},
                        {val:2, size:8}
                      ]

                    ]
                  ]
                ],
              ],
              ["stts",
                {version:0, size:8},
                {flags:0, size:24},
                {entry_count:0, size:32}
              ],
              ["stsc",
                {version:0, size:8},
                {flags:0, size:24},
                {entry_count:0, size:32}
              ],
              ["stco",
                {version:0, size:8},
                {flags:0, size:24},
                {entry_count:0, size:32}
              ],
              ["stsz",
                {version:0, size:8},
                {flags:0, size:24},
                {sample_size:0, size:32},
                {sample_count:0, size:32}
              ]
            ]
          ]
        ]
      ]
    ]
  ]

  var buffer = new Uint8Array(getLength(head))

  write(head, buffer, 0)
  return buffer
}

function getFragment(number, mp3Chunks, baseMediaDecodeTime){
  var moof =
    ["moof",
      ["mfhd",
        {version:0, size:8},
        {flags:0, size:24},
        {sequence_number: number , size:32}
      ],
      ["traf",
        ["tfhd",
          {version:0, size:8},
          {flags:0x020000, size:24},
          {track_ID:1 , size:32}
        ],
        ["tfdt",
          {version:0, size:8},
          {flags:0, size:24},
          {baseMediaDecodeTime: baseMediaDecodeTime, size:32}
        ],
        ["trun",
          {version:0, size:8},
          {flags:0x000201, size:24},
          {sample_count: mp3Chunks.length , size:32},
          {data_offset:0, size:32},
          {sample_size:[], size:32}
        ]
      ]
    ]

  moof[2][3][5].sample_size = mp3Chunks.map(chunk=>chunk.length)
  var moofLength = getLength(moof)
  moof[3][4][5].data_offset = moofLength

  var mdatLength = mp3Chunks.reduce((acc,chunk)=>acc+chunk.length, 0) + 4*2
  var buffer = new Uint8Array(moofLength+mdatLength)

  write(moof, buffer, 0)
  
  setUint(mdatLength, 32, buffer, moofLength)
  setString("mdat", buffer, moofLength+4)
  mp3Chunks.reduce((acc,chunk)=>{
    buffer.set(chunk, acc)
    return acc+chunk.length
  }, moofLength+8)
  
  return buffer
}

export default {getHeader, getFragment}