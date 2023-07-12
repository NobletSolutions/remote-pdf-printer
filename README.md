# remote-pdf-printer
Converts a URL or HTML into PDF via Headless Google Chrome instance

# End Points

PNG
* /png [POST]
* /png/:file [GET]

PDF
* /pdf [POST]
* /pdf/:file [GET]
* /pdf/preview [POST]
* /pdf/preview/:file [GET]


Both /pdf and /png POST expect x-www-form-urlencoded data.

data = html content OR
url = a url to retrieve and convert

Both data and url can be an array of urls or data.

download=true will return the actual data, without download=true you'll get a json response like this
and can use the GET .../:file urls to retrieve the files.

~~~
{ 
    "success":true,
    "pages":"1",
    "images": [
        "https://remote-pdf.example.com:3000/pdf/preview/9c2cd04b-1.jpg"
    ]
}
~~~

There are also the following additional parameters:

marginTop  = top page margin
marginLeft = left page margin
marginRight = right page margin
marginBottom = bottom page margin


header = HTML/CSS content to be used as the document header.
  if header is provided, marginTop is a required parameter.
footer = HTML/CSS content to be used as the document footer.
  if footer is provided, marginBottom is a required parameter.

