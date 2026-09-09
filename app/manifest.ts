import type { MetadataRoute } from 'next';

export default function manifest():MetadataRoute.Manifest{
  return {
    name:'Degens Sports Pools',short_name:'Degens Pools',description:'Survivor, Pick’em, standings and verified prize draws.',
    start_url:'/',scope:'/',display:'standalone',background_color:'#080a0f',theme_color:'#080a0f',orientation:'portrait-primary',
    categories:['sports','entertainment'],
    icons:[
      {src:'/icons/degens-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
      {src:'/icons/degens-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
      {src:'/icons/degens-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'},
    ],
  };
}
